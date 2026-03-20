import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleHelpers } from '../helpers/module.js'

async function importMetadataCache({
  readFile = vi.fn(),
  globby = vi.fn(),
  parse = vi.fn(),
  index = vi.fn(),
  loadExtensions = vi.fn(),
  getSplits = vi.fn(),
  resolve = vi.fn((specifier: string) => ModuleHelpers.resolve(specifier)),
}: {
  readFile?: ReturnType<typeof vi.fn>
  globby?: ReturnType<typeof vi.fn>
  parse?: ReturnType<typeof vi.fn>
  index?: ReturnType<typeof vi.fn>
  loadExtensions?: ReturnType<typeof vi.fn>
  getSplits?: ReturnType<typeof vi.fn>
  resolve?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  vi.doMock('fs-extra', () => ({
    default: {
      readFile,
    },
  }))
  vi.doMock('globby', () => ({
    globby,
  }))
  vi.doMock('yaml', () => ({
    default: {
      parse,
    },
  }))
  vi.doMock('./markdown-cache.js', () => ({
    MarkdownCache: {
      get: vi.fn((key: string) => ({
        index: () => index(key),
      })),
    },
  }))
  vi.doMock('./extensions-cache.js', () => ({
    ExtensionsCache: {
      loadExtensions,
    },
  }))
  vi.doMock('./config-cache.js', () => ({
    ConfigCache: {
      getSplits,
      getRoot: vi.fn((root: string) => root),
    },
  }))
  vi.doMock('../helpers/module.js', async () => {
    const actual = await vi.importActual('../helpers/module.js')
    return {
      ...actual,
      ModuleHelpers: {
        ...(actual as { ModuleHelpers: object }).ModuleHelpers,
        resolve,
      },
    }
  })

  return await import('./metadata-cache.js')
}

describe('MetadataCache', () => {
  beforeEach(() => {
    global.config = {
      sources: [{ root: 'docs' }, { root: 'blog', mount: 'articles' }],
    } as any
    global.command = 'build' as any
  })

  it('builds the search index from indexable markdown files', async () => {
    const { MetadataCache } = await importMetadataCache({
      index: vi.fn((key: string) =>
        Promise.resolve({ [key]: { l: key, c: [] } }),
      ),
    })

    await expect(
      MetadataCache.searchIndex({
        '/docs/a.md': { frontMatter: { indexable: true } },
        '/docs/b.md': { frontMatter: { indexable: false } },
      } as any),
    ).resolves.toEqual({
      '/docs/a.md': { '/docs/a.md': { l: '/docs/a.md', c: [] } },
    })
  })

  it('resolves layouts across the project and extensions, including yaml indirection', async () => {
    const extensionPath = ModuleHelpers.resolve('@markee/default')
    const { MetadataCache } = await importMetadataCache({
      loadExtensions: vi.fn().mockReturnValue({
        '@markee/default': extensionPath,
      }),
      globby: vi
        .fn()
        .mockResolvedValueOnce([
          '_header.yml',
          '_footer.html',
          '_layouts/docs.main.html',
        ])
        .mockResolvedValueOnce([
          '_header.html',
          '_footer.yml',
          '_layouts/docs.main.yml',
          '_layouts/docs.default.yml',
        ]),
      readFile: vi
        .fn()
        .mockResolvedValueOnce('extends: "@markee/default"\nsection: footer')
        .mockResolvedValueOnce(
          'extends: "@markee/default"\nlayout: docs\nsection: main',
        ),
      parse: vi
        .fn()
        .mockReturnValueOnce({ extends: '@markee/default', section: 'footer' })
        .mockReturnValueOnce({
          extends: '@markee/default',
          layout: 'docs',
          section: 'main',
        }),
    })

    await expect(MetadataCache.layoutsDetails()).resolves.toEqual({
      header: '/_assets/_header.html',
      footer: '/_assets/_extension/@markee/default/_assets/_footer.html',
      layouts: {
        docs: {
          main: '/_assets/_extension/@markee/default/_assets/_layouts/docs.main.html',
          right: undefined,
          left: undefined,
          top: undefined,
          bottom: undefined,
        },
      },
    })
  })

  it('collects assets from public, project assets, and sources with split rebasing', async () => {
    const makeImport = () =>
      importMetadataCache({
        globby: vi
          .fn()
          .mockResolvedValueOnce(['favicon.ico', '.well-known/asset'])
          .mockResolvedValueOnce(['logo.svg', 'layout.md', '.pages'])
          .mockResolvedValueOnce(['guide.pdf', 'index.md', '.pages'])
          .mockResolvedValueOnce(['news.json']),
        getSplits: vi
          .fn()
          .mockReturnValue([{ folder: '/docs', root: '/manual' }]),
      })

    const { MetadataCache } = await makeImport()

    await expect(MetadataCache.assets()).resolves.toEqual({
      '/docs/guide.pdf': '/manual/guide.pdf',
      '/blog/news.json': '/blog/news.json',
      '/public/favicon.ico': '/favicon.ico',
      '/public/.well-known/asset': '/.well-known/asset',
      '/_assets/logo.svg': '/_assets/logo.svg',
    })

    global.command = 'develop' as any
    const { MetadataCache: DevelopmentMetadataCache } = await makeImport()
    await expect(DevelopmentMetadataCache.assets()).resolves.toMatchObject({
      '/docs/guide.pdf': '/docs/guide.pdf',
    })
  })

  it('drops unresolved yaml header and footer indirections and falls back to main layouts', async () => {
    const { MetadataCache } = await importMetadataCache({
      loadExtensions: vi.fn().mockReturnValue({
        '@markee/default': ModuleHelpers.resolve('@markee/default'),
      }),
      globby: vi
        .fn()
        .mockResolvedValueOnce([
          '_header.yml',
          '_footer.yml',
          '_layouts/docs.main.yml',
        ])
        .mockResolvedValueOnce(['_layouts/docs.main.html']),
      readFile: vi
        .fn()
        .mockResolvedValueOnce('section: header')
        .mockResolvedValueOnce('section: footer')
        .mockResolvedValueOnce('layout: docs\nsection: main'),
      parse: vi
        .fn()
        .mockReturnValueOnce({ section: 'header' })
        .mockReturnValueOnce({ section: 'footer' })
        .mockReturnValueOnce({ layout: 'docs', section: 'main' }),
    })

    await expect(MetadataCache.layoutsDetails()).resolves.toEqual({
      header: undefined,
      footer: undefined,
      layouts: {
        docs: {
          main: '/_assets/_layouts/docs.main.html',
        },
      },
    })
  })

  it('resolves yaml headers through extensions and falls back to main layouts after repeated extends', async () => {
    const { MetadataCache } = await importMetadataCache({
      loadExtensions: vi.fn().mockReturnValue({
        '@markee/default': ModuleHelpers.resolve('@markee/default'),
      }),
      globby: vi
        .fn()
        .mockResolvedValueOnce(['_header.html', '_layouts/other.left.html'])
        .mockResolvedValueOnce(['_header.yml', '_layouts/docs.main.yml']),
      readFile: vi
        .fn()
        .mockResolvedValueOnce('extends: "@markee/default"\nsection: header')
        .mockResolvedValueOnce(
          'extends: "@markee/default"\nlayout: other\nsection: left',
        )
        .mockResolvedValueOnce(
          'extends: "@markee/default"\nlayout: other\nsection: left',
        ),
      parse: vi
        .fn()
        .mockReturnValueOnce({ extends: '@markee/default', section: 'header' })
        .mockReturnValueOnce({
          extends: '@markee/default',
          layout: 'other',
          section: 'left',
        })
        .mockReturnValueOnce({
          extends: '@markee/default',
          layout: 'other',
          section: 'left',
        }),
    })

    await expect(MetadataCache.layoutsDetails()).resolves.toEqual({
      header: '/_assets/_extension/@markee/default/_assets/_header.html',
      footer: undefined,
      layouts: {
        other: {
          left: '/_assets/_extension/@markee/default/_assets/_layouts/other.left.html',
        },
        docs: {
          main: '/_assets/_extension/@markee/default/_assets/_layouts/other.left.html',
        },
      },
    })
  })

  it('falls back to project layouts when an extension layout yaml repeats an already-visited extend', async () => {
    const { MetadataCache } = await importMetadataCache({
      loadExtensions: vi.fn().mockReturnValue({
        '@markee/default': ModuleHelpers.resolve('@markee/default'),
      }),
      globby: vi
        .fn()
        .mockResolvedValueOnce(['_layouts/other.left.yml'])
        .mockResolvedValueOnce([
          '_layouts/other.left.html',
          '_layouts/docs.main.yml',
        ]),
      readFile: vi
        .fn()
        .mockResolvedValueOnce(
          'extends: "@markee/default"\nlayout: other\nsection: left',
        )
        .mockResolvedValueOnce(
          'extends: "@markee/default"\nlayout: other\nsection: left',
        ),
      parse: vi
        .fn()
        .mockReturnValueOnce({
          extends: '@markee/default',
          layout: 'other',
          section: 'left',
        })
        .mockReturnValueOnce({
          extends: '@markee/default',
          layout: 'other',
          section: 'left',
        }),
    })

    await expect(MetadataCache.layoutsDetails()).resolves.toEqual({
      header: undefined,
      footer: undefined,
      layouts: {
        other: {
          left: '/_assets/_layouts/other.left.html',
        },
        docs: {
          main: '/_assets/_layouts/other.left.html',
        },
      },
    })
  })

  it('uses the default header section for header and footer yaml indirections in unscoped extensions', async () => {
    const resolve = vi
      .fn()
      .mockImplementation(
        (specifier: string) => `/resolved/${specifier}/index.js`,
      )
    const { MetadataCache } = await importMetadataCache({
      loadExtensions: vi.fn().mockReturnValue({
        default: '/resolved/default/index.js',
      }),
      resolve,
      globby: vi
        .fn()
        .mockResolvedValueOnce(['_header.yml'])
        .mockResolvedValueOnce(['_header.yml', '_footer.yml']),
      readFile: vi
        .fn()
        .mockResolvedValueOnce('extends: default')
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce('extends: default')
        .mockResolvedValueOnce('{}'),
      parse: vi
        .fn()
        .mockReturnValueOnce({ extends: 'default' })
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ extends: 'default' })
        .mockReturnValueOnce({}),
    })

    await expect(MetadataCache.layoutsDetails()).resolves.toEqual({
      header: undefined,
      footer: undefined,
      layouts: {},
    })
    expect(
      resolve.mock.calls.some(([specifier]) => specifier === 'default'),
    ).toBe(true)
  })
})
