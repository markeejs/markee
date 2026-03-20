import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ImportMarkdownOptions = {
  readProjectFile?: ReturnType<typeof vi.fn>
  pathExistsSync?: ReturnType<typeof vi.fn>
  exists?: ReturnType<typeof vi.fn>
  pathExists?: ReturnType<typeof vi.fn>
  getSplits?: ReturnType<typeof vi.fn>
  markdownCacheGet?: ReturnType<typeof vi.fn>
  getBuildTimeExtensions?: ReturnType<typeof vi.fn>
  hasBuildTimeExtensions?: ReturnType<typeof vi.fn>
  getExtensionFile?: ReturnType<typeof vi.fn>
  resolve?: ReturnType<typeof vi.fn>
  pathResolve?: ReturnType<typeof vi.fn>
}

async function importMarkdownCompute({
  readProjectFile = vi.fn(),
  pathExistsSync = vi.fn(),
  exists = vi.fn(),
  pathExists = vi.fn(),
  getSplits = vi.fn(() => []),
  markdownCacheGet = vi.fn(),
  getBuildTimeExtensions = vi.fn(() => []),
  hasBuildTimeExtensions = vi.fn(() => false),
  getExtensionFile = vi.fn(),
  resolve = vi.fn((value: string) => value),
  pathResolve = vi.fn((...parts: string[]) => path.resolve(...parts)),
}: ImportMarkdownOptions = {}) {
  vi.resetModules()

  vi.doMock('fs-extra', () => ({
    default: {
      pathExistsSync,
      exists,
      pathExists,
    },
  }))
  vi.doMock('../constants.js', () => ({
    ROOT_DIR: '/project',
  }))
  vi.doMock('../cache/file-cache.js', () => ({
    FileCache: {
      readProjectFile,
    },
  }))
  vi.doMock('../cache/config-cache.js', () => ({
    ConfigCache: {
      getRoot: vi.fn((root: string) => root),
      getSplits,
    },
  }))
  vi.doMock('../cache/markdown-cache.js', () => ({
    MarkdownCache: {
      get: markdownCacheGet,
    },
  }))
  vi.doMock('../cache/extensions-cache.js', () => ({
    ExtensionsCache: {
      getBuildTimeExtensions,
      hasBuildTimeExtensions,
      getExtensionFile,
    },
  }))
  vi.doMock('../helpers/module.js', () => ({
    ModuleHelpers: {
      resolve,
    },
  }))
  vi.doMock('../helpers/path.js', async () => {
    const actual = await vi.importActual('../helpers/path.js')
    return {
      ...actual,
      PathHelpers: {
        ...(actual as { PathHelpers: object }).PathHelpers,
        resolve: pathResolve,
      },
    }
  })

  return await import('./markdown.js')
}

describe('MarkdownCompute', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.config = {
      sources: [
        { root: 'pages' },
        { root: 'blog' },
        { root: 'docs', mount: 'manual' },
      ],
      plugins: {
        fileInclude: {
          includeCharacter: '!',
        },
        example: { fromConfig: true },
      },
    } as any
    global.command = 'build' as any
    global.mode = 'production' as any
  })

  it('builds initial file data and resolves markdown, self, raw, missing, and looping inclusions', async () => {
    const markdownCacheGet = vi.fn((file: string) => ({
      resolveInclusions: vi.fn(async () => {
        if (file === '/docs/included.md') {
          return '\n## Start\nKeep this\nEND\n'
        }
        if (file === '/docs/loop.md') {
          return 'Loop'
        }
        return ''
      }),
    }))
    const readProjectFile = vi.fn(async (file: string) => {
      if (file === '/docs/snippet.txt') {
        return '\nraw file\n'
      }
      throw new Error(`unexpected ${file}`)
    })
    const pathExistsSync = vi.fn((file: string) =>
      [
        '/project/docs/included.md',
        '/project/docs/snippet.txt',
        '/project/docs/loop.md',
      ].includes(file),
    )
    const { MarkdownCompute } = await importMarkdownCompute({
      markdownCacheGet,
      readProjectFile,
      pathExistsSync,
    })

    expect(
      MarkdownCompute.initialFileData('index.md', { root: 'pages' } as any),
    ).toEqual({
      path: '/pages/index.md',
      data: {
        link: '/pages',
        layout: 'pages',
        frontMatter: { excerpt: '' },
        readingTime: 0,
        payload: {},
      },
    })
    expect(
      MarkdownCompute.initialFileData('blog/blog.md', {
        root: 'docs',
        mount: 'manual',
      } as any),
    ).toEqual({
      path: '/docs/blog/blog.md',
      data: {
        link: '/manual/blog',
        layout: 'docs',
        frontMatter: { excerpt: '' },
        readingTime: 0,
        payload: {},
      },
    })

    const content = [
      'Before',
      '{!',
      'include-markdown "./included.md"',
      'start "##"',
      'end "END"',
      '!}',
      '{!',
      'include "./snippet.txt"',
      'rewrite-relative-urls false',
      'preserve-includer-indent false',
      '!}',
      '{!',
      'include-self true',
      'start "Before"',
      'end "raw file"',
      '!}',
      '{!',
      'include-markdown "./missing.md"',
      '!}',
      '{!',
      'include-markdown "./loop.md"',
      '!}',
    ].join('\n')

    const resolved = await MarkdownCompute.inclusions(
      '/docs/page.md',
      content,
      ['/docs/loop.md'],
    )

    expect(resolved).toContain('Keep this')
    expect(resolved).toContain('raw file')
    expect(resolved).toContain('Before')
    expect(resolved).toContain('<!-- markee:origin-indices:')
    expect(console.log).toHaveBeenCalledWith(
      'Cannot find included file with origin',
      './missing.md',
      'in file',
      '/docs/page.md',
    )
    expect(console.log).toHaveBeenCalledWith(
      'Detected loop following',
      expect.stringContaining('/docs/loop.md'),
    )
  })

  it('filters draft tokens, parses front matter, builds search data, and preloads fences and directives', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-markdown-ext-'),
    )
    const ext = path.join(tempDir, 'example.mjs')
    const duplicate = path.join(tempDir, 'duplicate.mjs')
    const broken = path.join(tempDir, 'broken.mjs')

    await fs.writeFile(
      ext,
      [
        "export const name = 'example'",
        'export async function preloadFence(params, config) {',
        "  return { lang: params.lang === 'js' ? 'ts' : params.lang, attrs: { ...params.attrs, class: 'fence', dataConfig: String(!!config?.fromConfig) }, payload: { changed: true } }",
        '}',
        'export async function preloadDirective(params) {',
        "  return { type: params.type === 'note' ? 'callout' : params.type, attrs: { ...params.attrs, collapsed: 'true' }, payload: { directive: true } }",
        '}',
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(
      duplicate,
      [
        "export const name = 'example'",
        'export async function preloadFence() {',
        '  return null',
        '}',
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(broken, "throw new Error('boom')\n", 'utf8')

    const { MarkdownCompute } = await importMarkdownCompute({
      hasBuildTimeExtensions: vi.fn(() => true),
      getBuildTimeExtensions: vi.fn(() => [ext, duplicate, broken]),
    })

    const source = [
      '---',
      'author: Jane',
      'authors: John',
      'tags: release',
      'hide: true',
      'image: ./images/cover.png',
      'description: A useful page',
      'plugins:',
      '  example:',
      '    fromFrontMatter: true',
      '---',
      '',
      '## Heading',
      '',
      'Visible [doc](./guide.md){version=latest}',
      '',
      ':::draft',
      'Hidden text',
      ':::',
      '',
      ':::note[Label]{role=alert}',
      'Directive body',
      ':::',
      '',
      '```js title="Example"',
      'console.log(1)',
      '```',
      '',
      '<!-- markee:origin-indices:[{"start":0,"directory":"/docs","file":"/docs/page.md"}] -->',
    ].join('\n')

    const productionTokens = await MarkdownCompute.tokens(source)
    global.mode = 'preview' as any
    const allTokens = await MarkdownCompute.tokens(source)

    expect(
      productionTokens.some(
        (token) => token.type === 'inline' && token.raw.includes('Hidden text'),
      ),
    ).toBe(false)
    expect(
      allTokens.some(
        (token) => token.type === 'inline' && token.raw.includes('Hidden text'),
      ),
    ).toBe(true)

    const frontMatter = await MarkdownCompute.frontMatter(allTokens, {
      file: '/docs/page.md',
      folder: '/docs',
      splits: [{ folder: '/docs', root: '/manual' }],
    })

    expect(frontMatter).toMatchObject({
      authors: ['John', 'Jane'],
      tags: ['release'],
      hidden: true,
      title: 'Heading',
      excerpt: 'A useful page',
      image: '/manual/docs/images/cover.png',
    })

    const searchIndex = MarkdownCompute.searchIndex(allTokens, {
      title: 'Fallback',
    })
    expect(searchIndex).toHaveProperty('#heading')
    expect(searchIndex['#heading']?.c.join('\n')).toContain('Visible [doc]')

    const links = new Set<string>()
    const linksData = new Map<string, any>()
    const payload: Record<string, Record<string, unknown>> = {}
    const sanitized = await MarkdownCompute.sanitizedContent(
      source,
      allTokens,
      {
        splits: [{ folder: '/docs', root: '/manual' }],
        links,
        linksData,
        payload,
        frontMatter,
      },
    )

    expect(sanitized).toContain('/docs/guide.md')
    expect(sanitized).toContain(":::callout[Label]{role='alert'")
    expect(sanitized).toContain("collapsed='true'")
    expect(sanitized).toContain("```ts title='Example'")
    expect(sanitized).toContain('.fence')
    expect([...links]).toEqual(['/docs/guide.md'])
    expect(linksData.get('/docs/guide.md')).toEqual([
      expect.objectContaining({ version: 'latest', file: '/docs/page.md' }),
    ])
    expect(Object.values(payload).some((entry) => entry.example)).toBe(true)
    expect(console.log).toHaveBeenCalledWith(
      'Another extension already registered the name',
      'example',
    )
    expect(console.error).toHaveBeenCalledWith(
      'An error occurred while running extension module',
      broken,
    )
  })

  it('detects broken links, handles versioned targets, and reports them', async () => {
    const markdownCacheGet = vi.fn((_file: string) => ({
      raw: 'See [bad](./missing.md)',
      readFromDisk: vi.fn(async () => 'Included line'),
    }))
    const { MarkdownCompute } = await importMarkdownCompute({
      markdownCacheGet,
      exists: vi.fn(
        async (candidate: string) =>
          candidate === '/project/docs/existing.md' ||
          candidate === '/project/docs/versioned.md',
      ),
      pathExists: vi.fn(
        async (file: string) => file === '/resolved/pkg/file.js',
      ),
      getExtensionFile: vi.fn(async (file: string) =>
        file === '/_assets/logo.svg' ? '/extension/logo.svg' : undefined,
      ),
      resolve: vi.fn((value: string) =>
        value === 'pkg/file.js' ? '/resolved/pkg/file.js' : value,
      ),
    })

    const broken = await MarkdownCompute.brokenLinks({
      source: [
        'Local bad link',
        'Asset link',
        'Versioned link',
        'Extension link',
      ].join('\n'),
      links: new Set(),
      linksData: new Map([
        [
          '/docs/missing.md',
          [{ line: 0, offset: 0, length: 7, file: '/docs/page.md' }],
        ],
        [
          '/_assets/logo.svg',
          [{ line: 1, offset: 0, length: 5, file: '/docs/page.md' }],
        ],
        [
          '/docs/versioned.md',
          [{ line: 2, offset: 0, length: 9, file: '/docs/page.md' }],
        ],
        [
          '/_assets/_extension/pkg/file.js',
          [
            {
              line: 3,
              offset: 0,
              length: 4,
              file: '/docs/include.md',
              version: 'fixed',
            },
          ],
        ],
      ]),
      frontMatter: { excerpt: '' },
      folders: {
        '/docs': { navigation: [] },
        '/docs/versioned.md': {
          navigation: [],
          version: { folder: true } as any,
        },
      } as any,
    })

    expect(broken).toEqual([
      expect.objectContaining({ link: '/docs/missing.md' }),
      expect.objectContaining({
        link: '/docs/versioned.md',
        unqualified: true,
      }),
    ])

    const count = await MarkdownCompute.reportBrokenLinks('/docs/page.md', [
      {
        link: '/docs/missing.md',
        offset: 4,
        length: 6,
        line: 'See [bad](./missing.md)',
        file: '/docs/page.md',
      },
      {
        link: '/docs/versioned.md',
        offset: 0,
        length: 9,
        line: 'Included line',
        file: '/docs/include.md',
        unqualified: true,
      },
    ])

    expect(count).toBe(2)
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    )
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Not found'),
    )
    expect(
      await MarkdownCompute.readingTime('one two three four'),
    ).toBeGreaterThan(0)
  })

  it('treats extension and asset links separately and reports unknown included locations', async () => {
    const markdownCacheGet = vi.fn((file: string) => ({
      raw: 'same line\n',
      readFromDisk: vi.fn(async () =>
        file === '/docs/include.md' ? 'other line\n' : '',
      ),
    }))
    const { MarkdownCompute } = await importMarkdownCompute({
      markdownCacheGet,
      exists: vi.fn(
        async (candidate: string) =>
          candidate === '/project/docs/found.md' ||
          candidate === '/project/docs/versioned/page.md',
      ),
      pathExists: vi.fn(async (file: string) => file === 'pkg/found.js'),
      getExtensionFile: vi.fn(async (file: string) =>
        file === '/_assets/logo.svg' ? '/extension/logo.svg' : undefined,
      ),
      resolve: vi.fn((value: string) => value),
    })

    const broken = await MarkdownCompute.brokenLinks({
      source: 'same line\nother line',
      links: new Set(),
      linksData: new Map([
        [
          '/docs/found.md',
          [{ line: 0, offset: 0, length: 4, file: '/docs/page.md' }],
        ],
        [
          '/_assets/_extension/pkg/found.js',
          [{ line: 0, offset: 0, length: 4, file: '/docs/page.md' }],
        ],
        [
          '/_assets/_extension/pkg/missing.js',
          [{ line: 0, offset: 0, length: 4, file: '/docs/page.md' }],
        ],
        [
          '/_assets/logo.svg',
          [{ line: 0, offset: 0, length: 4, file: '/docs/page.md' }],
        ],
        [
          '/_assets/missing.svg',
          [{ line: 0, offset: 0, length: 4, file: '/docs/page.md' }],
        ],
        [
          '/docs/versioned/page.md',
          [{ line: 1, offset: 2, length: 4, file: '/docs/include.md' }],
        ],
      ]),
      frontMatter: { excerpt: '' },
      folders: {
        '/docs/versioned': { version: { folder: true } as any },
      } as any,
    })

    expect(broken).toEqual([
      expect.objectContaining({ link: '/_assets/_extension/pkg/missing.js' }),
      expect.objectContaining({ link: '/_assets/missing.svg' }),
      expect.objectContaining({
        link: '/docs/versioned/page.md',
        unqualified: true,
      }),
    ])

    await expect(
      MarkdownCompute.reportBrokenLinks('/docs/page.md', [
        {
          link: '/missing.md',
          offset: 0,
          length: 4,
          line: 'same line',
          file: '/docs/page.md',
        },
        {
          link: '/versioned.md',
          offset: 2,
          length: 4,
          line: 'unknown line',
          file: '/docs/include.md',
          unqualified: true,
        },
      ]),
    ).resolves.toBe(2)

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Unknown location'),
    )
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Links to versioned files need to be tagged'),
    )
  })

  it('falls back to h2 titles, truncates generated excerpts, and builds search sections from fallback titles', async () => {
    const { MarkdownCompute } = await importMarkdownCompute()
    const tokens = [
      {
        type: 'inline',
        tag: 'h2',
        title: 'Secondary heading',
        raw: '## Secondary heading',
        attrs: {},
      },
      {
        type: 'inline',
        raw: '<!-- markee:origin-indices:[1] -->',
        text: 'ignored',
      },
      {
        type: 'inline',
        raw: 'alpha '.repeat(60).trim(),
        text: 'alpha '.repeat(60).trim(),
      },
      {
        type: 'fence',
        raw: '```ts\nconst a = 1\n```',
      },
    ] as any
    const searchTokens = [
      {
        type: 'inline',
        raw: 'alpha body',
      },
      {
        type: 'fence',
        raw: '```ts\nconst a = 1\n```',
      },
    ] as any

    const frontMatter = await MarkdownCompute.frontMatter(tokens, {
      file: '/docs/page.md',
      folder: '/docs',
      splits: [],
    })
    const searchIndex = MarkdownCompute.searchIndex(searchTokens, {
      title: 'Fallback title',
    })

    expect(frontMatter.title).toBe('Secondary heading')
    expect(frontMatter.excerpt?.endsWith('...')).toBe(true)
    expect(frontMatter.excerpt?.length).toBeGreaterThan(200)
    expect(searchIndex['#fallback-title']).toMatchObject({
      l: 'Fallback title',
      lv: 'h1',
      c: [expect.stringContaining('alpha')],
    })
    expect(searchIndex['#fallback-title']?.c[0]).toContain('```ts')
  })

  it('resolves default-delimiter self includes, relative source files, and extension asset includes', async () => {
    global.config = {
      sources: [{ root: 'docs' }],
      plugins: {},
    } as any

    const readProjectFile = vi.fn(async (file: string) => {
      if (file === 'docs/local.txt') return 'local include\n'
      if (file === 'docs/delimited.txt') return 'AAA\nSTART\ninside\nEND\nBBB\n'
      if (file === 'docs/blank.txt') return '\n\n'
      if (file === '/_assets/_extension/pkg/snippet.txt')
        return 'extension include\n'
      throw new Error(`unexpected ${file}`)
    })
    const pathExistsSync = vi.fn((file: string) =>
      [
        '/project/docs/local.txt',
        '/project/docs/delimited.txt',
        '/project/docs/blank.txt',
        '/resolved/pkg/snippet.txt',
      ].includes(file),
    )
    const { MarkdownCompute } = await importMarkdownCompute({
      readProjectFile,
      pathExistsSync,
      resolve: vi.fn((value: string) =>
        value === 'pkg/snippet.txt' ? '/resolved/pkg/snippet.txt' : value,
      ),
      pathResolve: vi.fn((from: string, to: string) => {
        if (from === 'docs' && to === './local.txt')
          return '/project/docs/local.txt'
        if (from === 'docs' && to === './delimited.txt')
          return '/project/docs/delimited.txt'
        if (from === 'docs' && to === './blank.txt')
          return '/project/docs/blank.txt'
        return path.resolve(from, to)
      }),
    })

    await expect(
      MarkdownCompute.inclusions(
        'docs/page.md',
        ['Before', '{!', 'include "./local.txt"', '!}'].join('\n'),
      ),
    ).resolves.toContain('local include')
    await expect(
      MarkdownCompute.inclusions(
        'docs/page.md',
        [
          '{!',
          'include "./delimited.txt"',
          'start "START"',
          'end "END"',
          'preserve-delimiters false',
          '!}',
        ].join('\n'),
      ),
    ).resolves.toContain('inside')
    await expect(
      MarkdownCompute.inclusions(
        'docs/page.md',
        ['{!', 'include "./blank.txt"', '!}'].join('\n'),
      ),
    ).resolves.toContain('<!-- markee:origin-indices:')

    await expect(
      MarkdownCompute.inclusions(
        '/docs/page.md',
        ['{!', 'include "/_assets/_extension/pkg/snippet.txt"', '!}'].join(
          '\n',
        ),
      ),
    ).resolves.toContain('extension include')

    await expect(
      MarkdownCompute.inclusions(
        '/docs/page.md',
        ['alpha', '{!', 'include-self true', 'start "alpha"', '!}'].join('\n'),
      ),
    ).resolves.toContain('alpha')
  })

  it('parses malformed front matter through yaml and string fallbacks', async () => {
    const { MarkdownCompute } = await importMarkdownCompute()

    const parsedYaml = await MarkdownCompute.frontMatter(
      [{ type: 'front_matter', meta: 'foo\nbar: baz' }] as any,
      { file: '/docs/page.md', folder: '/docs', splits: [] },
    )
    const parsedString = await MarkdownCompute.frontMatter(
      [{ type: 'front_matter', meta: '[oops' }] as any,
      { file: '/docs/page.md', folder: '/docs', splits: [] },
    )

    expect(parsedYaml).toMatchObject({
      default: 'foo',
      bar: 'baz',
      excerpt: '',
    })
    expect(parsedString).toMatchObject({
      default: '[oops',
      excerpt: '',
    })
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Non-YAML front-matter content found at'),
      expect.any(String),
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Front-matter will be parsed as YAML'),
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Front-matter will be parsed as a string entry'),
    )
  })

  it('normalizes author and authors arrays and wraps lone authors values', async () => {
    const { MarkdownCompute } = await importMarkdownCompute()

    const mergedAuthors = await MarkdownCompute.frontMatter(
      [
        {
          type: 'front_matter',
          meta: [
            'authors:',
            '  - John',
            'author:',
            '  - Jane',
            '  - Jack',
          ].join('\n'),
        },
      ] as any,
      { file: '/docs/page.md', folder: '/docs', splits: [] },
    )
    const wrappedAuthors = await MarkdownCompute.frontMatter(
      [{ type: 'front_matter', meta: 'authors: John' }] as any,
      { file: '/docs/page.md', folder: '/docs', splits: [] },
    )

    expect(mergedAuthors.authors).toEqual(['John', 'Jane', 'Jack'])
    expect(wrappedAuthors.authors).toEqual(['John'])
  })

  it('sanitizes h1 titles, draft blocks, external links, and empty broken-link reports', async () => {
    const { MarkdownCompute } = await importMarkdownCompute()

    global.mode = 'preview' as any
    const content = [
      '# Real title',
      '',
      ':::draft',
      'secret',
      ':::',
      '',
      'Visible [mail](mailto:test@example.com)\r',
      'Final [hash](#here)',
    ].join('\n')
    const tokens = await MarkdownCompute.tokens(content)

    global.mode = 'production' as any

    const frontMatter = await MarkdownCompute.frontMatter(tokens, {
      file: '/docs/page.md',
      folder: '/docs',
      splits: [],
    })
    const searchIndex = MarkdownCompute.searchIndex(tokens, {
      title: 'Fallback title',
    })
    const links = new Set<string>()
    const linksData = new Map<string, any>()
    const payload: Record<string, Record<string, unknown>> = {}
    const sanitized = await MarkdownCompute.sanitizedContent(content, tokens, {
      splits: [],
      links,
      linksData,
      payload,
      frontMatter,
    })

    expect(frontMatter.title).toBe('Real title')
    expect(searchIndex['#real-title']).toBeDefined()
    expect(searchIndex['#fallback-title']).toBeUndefined()
    expect(sanitized).not.toContain('secret')
    expect(sanitized).toContain('mailto:test@example.com')
    expect(sanitized).toContain('#here')
    expect([...links]).toEqual([])
    await expect(
      MarkdownCompute.reportBrokenLinks('/docs/page.md', []),
    ).resolves.toBe(0)
  })

  it('rewrites local links with windows-like sanitized paths and handles build-time extension edge cases', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-markdown-build-'),
    )
    const noName = path.join(tempDir, 'no-name.mjs')
    const noPreload = path.join(tempDir, 'no-preload.mjs')
    const nullish = path.join(tempDir, 'nullish.mjs')
    const same = path.join(tempDir, 'same.mjs')
    const mutate = path.join(tempDir, 'mutate.mjs')

    await fs.writeFile(
      noName,
      'export async function preloadFence() { return {} }\n',
      'utf8',
    )
    await fs.writeFile(noPreload, "export const name = 'nopreload'\n", 'utf8')
    await fs.writeFile(
      nullish,
      [
        "export const name = 'nullish'",
        'export async function preloadFence() { return null }',
        'export async function preloadDirective() { return 0 }',
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(
      same,
      [
        "export const name = 'same'",
        'export async function preloadFence(params) {',
        '  return { lang: params.lang, attrs: { ...params.attrs } }',
        '}',
        'export async function preloadDirective(params) {',
        '  return { type: params.type, attrs: { ...params.attrs } }',
        '}',
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(
      mutate,
      [
        "export const name = 'example'",
        'export async function preloadFence(params, cfg) {',
        "  if (params.content.trim() === 'plain') return { payload: { only: true } }",
        "  if (params.lang === 'js') return null",
        "  return { attrs: { disabled: 'disabled', count: 2, configFlag: String(!!cfg?.fromConfig) }, payload: { changed: true } }",
        '}',
        'export async function preloadDirective(params, cfg) {',
        "  if (params.type === 'same') return { type: params.type, attrs: { ...params.attrs }, payload: null }",
        "  if (params.type === 'badge') return { type: 'callout', attrs: { open: 'open' }, payload: null }",
        "  return { type: 'callout', attrs: {}, payload: { fromConfig: !!cfg?.fromConfig } }",
        '}',
      ].join('\n'),
      'utf8',
    )

    const { MarkdownCompute } = await importMarkdownCompute({
      hasBuildTimeExtensions: vi.fn(() => true),
      getBuildTimeExtensions: vi.fn(() => [
        noName,
        noPreload,
        nullish,
        same,
        mutate,
      ]),
      pathResolve: vi.fn((folder: string, link: string) =>
        link === './guide.md'
          ? 'C:/docs/guide.md'
          : link === './folder/'
            ? 'C:/docs/folder/'
            : path.resolve(folder, link),
      ),
    })

    const source = [
      'See [local](./guide.md){version=fixed}',
      'Also [folder](./folder/)',
      '',
      '```',
      'body',
      '```',
      '',
      '```',
      'plain',
      '```',
      '',
      '```js',
      'code',
      '```',
      '',
      '::note',
      '',
      '::badge[Label]',
      '',
      '::same[Label]{#keep-dir}',
    ].join('\n')
    const tokens = await MarkdownCompute.tokens(source)
    const links = new Set<string>()
    const linksData = new Map<string, any>()
    const payload: Record<string, Record<string, unknown>> = {}

    const sanitized = await MarkdownCompute.sanitizedContent(
      source +
        '\n<!-- markee:origin-indices:[{"start":0,"directory":"/docs","file":"/docs/page.md"}] -->',
      tokens,
      {
        splits: [{ folder: '/docs', root: '/manual' }],
        links,
        linksData,
        payload,
        frontMatter: { excerpt: '', plugins: {} },
      },
    )

    expect(sanitized).toContain('/docs/guide.md')
    expect(sanitized).toContain('/manual/docs/folder/')
    expect(sanitized).toContain(
      "```none #mk-payload-1 disabled count=2 configFlag='true'",
    )
    expect(sanitized).toContain('```none #mk-payload-2')
    expect(sanitized).toContain('::callout')
    expect(sanitized).toContain('::callout[Label]{#mk-payload-5 open}')
    expect(sanitized).toContain('```js')
    expect(sanitized).toContain('::same[Label]{#keep-dir}')
    expect([...links]).toEqual(['/docs/guide.md', '/docs/folder'])
    expect(linksData.get('/docs/guide.md')).toEqual([
      expect.objectContaining({ version: 'fixed', file: '/docs/page.md' }),
    ])
    expect(Object.values(payload).some((entry) => entry.example)).toBe(true)
  })

  it('handles overlapping link spans by sorting and skipping stale ranges', async () => {
    const { MarkdownCompute } = await importMarkdownCompute()
    const content =
      'mailto:test\n<!-- markee:origin-indices:[{"start":0,"directory":"/docs","file":"/docs/page.md"}] -->'
    const tokens = [
      {
        type: 'inline',
        raw: 'mailto:test',
        text: 'mailto:test',
        map: [0, 0],
        links: [
          { url: 'mailto:test', line: 0, start: 0, end: 11 },
          { url: 'mailto:', line: 0, start: 0, end: 7 },
        ],
      },
    ] as any

    const sanitized = await MarkdownCompute.sanitizedContent(content, tokens, {
      splits: [],
      links: new Set<string>(),
      linksData: new Map<string, any>(),
      payload: {},
      frontMatter: { excerpt: '' },
    })

    expect(sanitized).toContain('mailto:test')
  })
})
