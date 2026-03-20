import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importSectionCompute(readProjectFile: ReturnType<typeof vi.fn>) {
  vi.resetModules()

  vi.doMock('../cache/file-cache.js', () => ({
    FileCache: {
      readProjectFile,
    },
  }))
  vi.doMock('../cache/config-cache.js', () => ({
    ConfigCache: {
      getRoot: vi.fn((root: string) => root),
    },
  }))

  return await import('./section.js')
}

describe('SectionCompute', () => {
  beforeEach(() => {
    global.config = {
      sources: [{ root: 'docs', mount: 'manual' }, { root: 'blog' }],
    } as any
  })

  it('builds navigation from .pages, .section, patterns, arrange, exclusions, and versioned folders', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      const files: Record<string, string> = {
        '/docs/.pages': [
          'title: Docs',
          'hide: true',
          'draft: true',
          'indexable: false',
          'navigation:',
          '  - Home: index.md',
          '  - guide:',
          '      title: Guide',
          '      navigation:',
          '        - intro.md',
          '        - --- | *.md | desc',
          '  - reference:',
          '      title: Reference',
          '      navigation:',
          '        - api.md',
          '  - regex=^hidden$ | asc',
        ].join('\n'),
        '/docs/guide/.section': [
          'title: Guide Section',
          'nav:',
          '  - intro.md',
          '  - --- | *.md | desc',
        ].join('\n'),
        '/docs/versioned/.version': [
          'mode: folder',
          'title: Versioned docs',
        ].join('\n'),
        '/blog/.pages': ['arrange:', '  - post.md'].join('\n'),
      }

      if (normalized in files) {
        return files[normalized] as string
      }

      throw new Error(`missing ${file}`)
    })

    const markdownFiles = {
      '/docs/index.md': { frontMatter: { excerpt: '' } },
      '/docs/guide/intro.md': { frontMatter: { excerpt: '' } },
      '/docs/guide/extra.md': { frontMatter: { excerpt: '' } },
      '/docs/reference/api.md': { frontMatter: { excerpt: '' } },
      '/docs/hidden/child.md': { frontMatter: { excerpt: '' } },
      '/docs/orphan.md': { frontMatter: { excerpt: '' } },
      '/docs/versioned/v1.md': { frontMatter: { excerpt: '' } },
      '/blog/post.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/']?.navigation).toEqual([{ key: '/docs' }, { key: '/blog' }])
    expect(pages['/docs']).toMatchObject({
      title: 'Docs',
      link: '/manual',
      hidden: true,
      draft: true,
      indexable: false,
    })
    expect(pages['/docs']?.navigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: '/docs/index.md', title: 'Home' }),
        expect.objectContaining({ key: '/docs/guide#1', title: 'Guide' }),
        expect.objectContaining({
          key: '/docs/reference#1',
          title: 'Reference',
        }),
      ]),
    )
    expect(pages['/docs/guide#1']?.navigation).toEqual(
      expect.arrayContaining([{ key: '/docs/guide/intro.md' }]),
    )
    expect(pages['/docs/reference#1']?.navigation).toEqual([
      { key: '/docs/reference/api.md' },
    ])
    expect(pages['/docs']?.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: '/docs/orphan.md' }),
      ]),
    )
    expect(markdownFiles['/docs/orphan.md'].frontMatter.hidden).toBe(true)
    expect(pages['/docs/versioned']).toMatchObject({
      title: 'Versioned docs',
      version: { folder: true, mode: 'folder', title: 'Versioned docs' },
      versions: [{ key: '/docs/versioned' }],
      navigation: [],
      excluded: [],
    })
    expect(pages['/blog']).toMatchObject({
      link: '/blog',
      navigation: [{ key: '/blog/post.md' }],
    })
  })

  it('falls back to inferred titles and default rest navigation when no config files exist', async () => {
    const readProjectFile = vi.fn(async () => {
      throw new Error('missing')
    })
    const markdownFiles = {
      '/docs/getting-started.md': { frontMatter: { excerpt: '' } },
      '/docs/nested/index.md': { frontMatter: { excerpt: '' } },
      '/blog/2024-hello-world.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs'].inferredTitle).toBe('Docs')
    expect(pages['/docs/nested'].inferredTitle).toBe('Nested')
    expect(pages['/blog'].navigation).toEqual([
      { key: '/blog/2024-hello-world.md' },
    ])
    expect(pages['/docs'].navigation).toEqual(
      expect.arrayContaining([
        { key: '/docs/getting-started.md' },
        { key: '/docs/nested' },
      ]),
    )
  })

  it('treats blank section config files as empty YAML objects', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return ''
      }
      throw new Error('missing')
    })
    const markdownFiles = {
      '/docs/page.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']).toMatchObject({
      inferredTitle: 'Docs',
      navigation: [{ key: '/docs/page.md' }],
    })
  })

  it('supports descending rest ordering and file-based versioning', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return ['order: desc'].join('\n')
      }
      if (normalized === '/docs/versioned/.version') {
        return ['mode: file', 'title: Versioned files'].join('\n')
      }
      throw new Error('missing')
    })
    const markdownFiles = {
      '/docs/a.md': { frontMatter: { excerpt: '' } },
      '/docs/b.md': { frontMatter: { excerpt: '' } },
      '/docs/versioned/v1.md': { frontMatter: { excerpt: '' } },
      '/docs/versioned/v2.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs'].navigation).toEqual([
      { key: '/docs/versioned' },
      { key: '/docs/b.md' },
      { key: '/docs/a.md' },
    ])
    expect(pages['/docs/versioned']).toMatchObject({
      title: 'Versioned files',
      version: { folder: false, mode: 'file', title: 'Versioned files' },
      versions: [
        { key: '/docs/versioned/v1.md' },
        { key: '/docs/versioned/v2.md' },
      ],
    })
  })

  it('treats a blank version file as an empty version config', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/versioned/.version') {
        return ''
      }
      throw new Error('missing')
    })
    const markdownFiles = {
      '/docs/versioned/v1.md': { frontMatter: { excerpt: '' } },
      '/docs/versioned/v2.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs/versioned']).toMatchObject({
      version: { folder: false },
      versions: [{ key: '/docs/versioned/v1.md' }, { key: '/docs/versioned/v2.md' }],
    })
  })

  it('extracts nested sections and resolves parent-crossing patterns and descending rest entries', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return [
          'navigation:',
          '  - group:',
          '      navigation:',
          '        - nested:',
          '            navigation:',
          '              - guide.md',
          '  - --- | ../shared/*.md | asc',
          '  - ...',
          'order: desc',
        ].join('\n')
      }
      throw new Error('missing')
    })

    const markdownFiles = {
      '/docs/group/nested/guide.md': { frontMatter: { excerpt: '' } },
      '/docs/a.md': { frontMatter: { excerpt: '' } },
      '/docs/b.md': { frontMatter: { excerpt: '' } },
      '/docs/shared/reference.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']?.navigation).toEqual(
      expect.arrayContaining([
        { key: '/docs/group#1' },
        { key: '/docs/shared' },
        { key: '/docs/group' },
        { key: '/docs/b.md' },
        { key: '/docs/a.md' },
      ]),
    )
    expect(pages['/docs/group#1']?.navigation).toEqual([
      { key: '/docs/group/nested#1' },
    ])
    expect(pages['/docs/group/nested#1']?.navigation).toEqual([
      { key: '/docs/group/nested/guide.md' },
    ])
    expect(pages['/docs/shared']?.navigation).toEqual([
      { key: '/docs/shared/reference.md' },
    ])
  })

  it('keeps virtual sections and reapplies pattern origins within nested virtual sections', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return [
          'navigation:',
          '  - virtual:',
          '      - nested:',
          '          - --- | guide.md | asc',
        ].join('\n')
      }
      throw new Error('missing')
    })

    const markdownFiles = {
      '/docs/guide.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']?.navigation).toEqual([
      { key: '/docs/virtual', title: 'virtual' },
    ])
    expect(pages['/docs/virtual']?.navigation).toEqual([
      { key: '/docs/virtual/nested', title: 'nested' },
    ])
    expect(pages['/docs/virtual/nested']?.navigation).toEqual([
      { key: '/docs/guide.md' },
    ])
  })

  it('creates virtual folder entries even when no backing folder exists on disk', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return [
          'navigation:',
          '  - virtual-folder:',
          '      title: Virtual Folder',
          '      navigation:',
          '        - ../guide.md',
        ].join('\n')
      }
      throw new Error('missing')
    })

    const markdownFiles = {
      '/docs/guide.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']?.navigation).toEqual([
      { key: '/docs/virtual-folder#1', title: 'Virtual Folder' },
    ])
    expect(pages['/docs/virtual-folder#1']?.navigation).toEqual([
      { key: '/docs/guide.md' },
    ])
    expect(pages['/docs/virtual-folder#1']?.title).toBe('Virtual Folder')
  })

  it('supports arrange with rest placeholders, external links, and sections that resolve to real folders', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return [
          'navigation:',
          '  - https://example.com',
          '  - shared:',
          '      - page.md',
        ].join('\n')
      }
      if (normalized === '/blog/.pages') {
        return ['arrange:', '  - post.md', '  - ...', '  - post.md'].join('\n')
      }
      throw new Error('missing')
    })

    const markdownFiles = {
      '/docs/guide.md': { frontMatter: { excerpt: '' } },
      '/docs/other.md': { frontMatter: { excerpt: '' } },
      '/docs/shared/page.md': { frontMatter: { excerpt: '' } },
      '/blog/post.md': { frontMatter: { excerpt: '' } },
      '/blog/other.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']?.navigation).toEqual(
      expect.arrayContaining([
        { key: 'https://example.com', title: 'https://example.com' },
        { key: '/docs/shared#1' },
      ]),
    )
    expect(pages['/docs']?.excluded).toEqual(
      expect.arrayContaining([
        { key: '/docs/guide.md' },
        { key: '/docs/other.md' },
      ]),
    )
    expect(pages['/docs/shared#1']?.navigation).toEqual([
      { key: '/docs/shared/page.md' },
    ])
    expect(pages['/blog']?.navigation).toEqual([
      { key: '/blog/post.md' },
      { key: '/blog/other.md' },
    ])
  })

  it('supports folder entries without nested navigation and unanchored regex patterns', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return [
          'navigation:',
          '  - empty-folder:',
          '      title: Empty Folder',
          '  - --- | regex=orphan\\.md',
        ].join('\n')
      }
      throw new Error('missing')
    })

    const markdownFiles = {
      '/docs/orphan.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']?.navigation).toEqual(
      expect.arrayContaining([
        { key: '/docs/empty-folder#1', title: 'Empty Folder' },
        { key: '/docs/orphan.md' },
      ]),
    )
    expect(pages['/docs/empty-folder#1']?.title).toBe('Empty Folder')
    expect(pages['/docs/empty-folder#1']?.navigation).toEqual([])
  })

  it('supports descending pattern resolution order', async () => {
    const readProjectFile = vi.fn(async (file: string) => {
      const normalized = file.replaceAll('\\', '/')
      if (normalized === '/docs/.pages') {
        return ['navigation:', '  - --- | *.md | desc'].join('\n')
      }
      throw new Error('missing')
    })

    const markdownFiles = {
      '/docs/a.md': { frontMatter: { excerpt: '' } },
      '/docs/b.md': { frontMatter: { excerpt: '' } },
    } as any

    const { SectionCompute } = await importSectionCompute(readProjectFile)
    const pages = await SectionCompute.navigationStructure(markdownFiles)

    expect(pages['/docs']?.navigation).toEqual([
      { key: '/docs/b.md' },
      { key: '/docs/a.md' },
    ])
  })
})
