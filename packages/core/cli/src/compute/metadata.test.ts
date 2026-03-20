import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importMetadata({
  getRevisionDate = vi.fn(),
  sortFiles = vi.fn(),
}: {
  getRevisionDate?: ReturnType<typeof vi.fn>
  sortFiles?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  vi.doMock('../cache/git-cache.js', () => ({
    GitCache: {
      getRevisionDate,
    },
  }))
  vi.doMock('../helpers/filesystem.js', () => ({
    FilesystemHelpers: {
      sortFiles,
    },
  }))

  return {
    ...(await import('./metadata.js')),
    getRevisionDate,
    sortFiles,
  }
}

describe('MetadataCompute', () => {
  beforeEach(() => {
    global.mode = 'preview'
  })

  it('inherits front matter, titles, visibility, and layout from folder metadata', async () => {
    const { MetadataCompute, getRevisionDate } = await importMetadata({
      getRevisionDate: vi.fn(async (file) => `${file}:rev`),
    })

    const files = {
      '/docs/getting-started.md': {
        link: '/docs/getting-started',
        layout: '',
        frontMatter: { layout: 'article' },
      },
      '/docs/index.md': {
        link: '/docs',
        layout: '',
        frontMatter: {},
      },
      '/guides/tutorial.md': {
        link: '/guides/tutorial',
        layout: '',
        frontMatter: {},
      },
      '/plain/my-file.md': {
        link: '/plain/my-file',
        layout: '',
        frontMatter: {},
      },
    } as unknown as Record<string, MarkdownFile>
    const folders = {
      '/': {
        meta: { authors: ['root'] },
        navigation: [
          { key: '/docs', title: 'Docs Home' },
          { key: '/other/tutorial', title: 'Parent Tutorial' },
        ],
      },
      '/docs': {
        meta: { tags: ['docs'] },
        navigation: [{ key: '/docs/getting-started.md', title: 'Quick Start' }],
        draft: true,
        hidden: true,
        indexable: false,
      },
    } as unknown as Record<string, SectionFile>

    await MetadataCompute.frontMatterInheritance(files, folders)

    expect(getRevisionDate).toHaveBeenCalledTimes(4)
    expect(files['/docs/getting-started.md']).toMatchObject({
      revisionDate: '/docs/getting-started.md:rev',
      layout: 'article',
      frontMatter: {
        title: 'Quick Start',
        authors: ['root'],
        tags: ['docs'],
        draft: true,
        hidden: true,
        indexable: false,
        layout: 'article',
      },
    })
    expect(files['/docs/index.md']?.frontMatter.title).toBe('Docs Home')
    expect(files['/guides/tutorial.md']?.frontMatter.title).toBe(
      'Parent Tutorial',
    )
    expect(files['/plain/my-file.md']?.frontMatter.title).toBe('My file')
  })

  it('removes draft files in production and direct descendants of version folders', async () => {
    global.mode = 'production'
    const { MetadataCompute } = await importMetadata({
      getRevisionDate: vi.fn(async () => 'rev'),
    })

    const files = {
      '/drafts/post.md': {
        link: '/drafts/post',
        layout: '',
        frontMatter: {},
      },
      '/versions/v1/page.md': {
        link: '/versions/v1/page',
        layout: '',
        frontMatter: {},
      },
    } as unknown as Record<string, MarkdownFile>
    const folders = {
      '/drafts': {
        draft: true,
        navigation: [],
      },
      '/versions/v1': {
        navigation: [],
        version: { folder: true },
      },
    } as unknown as Record<string, SectionFile>

    await MetadataCompute.frontMatterInheritance(files, folders)

    expect(files['/drafts/post.md']).toBeUndefined()
    expect(files['/versions/v1/page.md']).toBeUndefined()
  })

  it('orders versioned content and rewrites latest aliases for folders and files', async () => {
    const { MetadataCompute, sortFiles } = await importMetadata({
      sortFiles: vi.fn(() => -1),
    })

    const files = {
      '/docs/v1/page.md': {
        link: '/docs/v1/page',
        frontMatter: {},
      },
      '/docs/v2/page.md': {
        link: '/docs/v2/page',
        frontMatter: {},
      },
      '/changelog-v1.md': {
        link: '/changelog-v1',
        frontMatter: { version: { date: '2024-01-01' } },
      },
      '/changelog-v2.md': {
        link: '/changelog-v2',
        frontMatter: { version: { date: '2025-01-01' } },
      },
      '/misc-a.md': {
        link: '/misc-a',
        frontMatter: {},
      },
      '/misc-b.md': {
        link: '/misc-b',
        frontMatter: {},
      },
      '/partial-a.md': {
        link: '/partial-a',
        frontMatter: { version: { date: '2024-01-01' } },
      },
      '/partial-b.md': {
        link: '/partial-b',
        frontMatter: {},
      },
      '/partial-c.md': {
        link: '/partial-c',
        frontMatter: {},
      },
      '/partial-d.md': {
        link: '/partial-d',
        frontMatter: { version: { date: '2025-01-01' } },
      },
    } as unknown as Record<string, MarkdownFile>
    const folders = {
      '/docs': {
        link: '/docs',
        version: { folder: true, latestPathAlias: 'latest' },
        versions: [{ key: '/docs/v1' }, { key: '/docs/v2' }],
      },
      '/docs/v1': {
        link: '/docs/v1',
        version: { date: '2024-01-01' },
      },
      '/docs/v2': {
        link: '/docs/v2',
        version: { date: '2025-01-01' },
      },
      '/changelog': {
        link: '/changelog',
        version: { latestPathAlias: 'current' },
        versions: [{ key: '/changelog-v1.md' }, { key: '/changelog-v2.md' }],
      },
      '/misc': {
        versions: [{ key: '/misc-a.md' }, { key: '/misc-b.md' }],
      },
      '/partial-left': {
        versions: [{ key: '/partial-a.md' }, { key: '/partial-b.md' }],
      },
      '/partial-right': {
        versions: [{ key: '/partial-c.md' }, { key: '/partial-d.md' }],
      },
    } as unknown as Record<string, SectionFile>

    MetadataCompute.versionedContentOrdering(files, folders)

    expect(folders['/docs'].versions?.[0]?.key).toBe('/docs/v2')
    expect(files['/docs/v2/page.md']).toMatchObject({
      link: '/docs/latest/page',
      alias: ['/docs/v2/page'],
    })
    expect(folders['/docs/v2']).toMatchObject({
      link: '/docs/latest',
      alias: ['/docs/v2'],
    })
    expect(files['/changelog-v2.md']).toMatchObject({
      link: '/changelog/current',
      alias: ['/changelog-v2'],
    })
    expect(folders['/partial-left'].versions?.[0]?.key).toBe('/partial-a.md')
    expect(folders['/partial-right'].versions?.[0]?.key).toBe('/partial-d.md')
    expect(sortFiles).toHaveBeenCalledWith('/misc-a.md', '/misc-b.md')
  })
})
