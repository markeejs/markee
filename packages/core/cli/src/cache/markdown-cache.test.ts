import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importMarkdownCache({
  globby = vi.fn(),
  readProjectFile = vi.fn(),
  getSplits = vi.fn(() => []),
  initialFileData = vi.fn(),
  inclusions = vi.fn(),
  tokens = vi.fn(),
  frontMatter = vi.fn(),
  sanitizedContent = vi.fn(),
  searchIndex = vi.fn(),
  brokenLinks = vi.fn(),
  reportBrokenLinks = vi.fn(),
  readingTime = vi.fn(),
  frontMatterInheritance = vi.fn(),
  versionedContentOrdering = vi.fn(),
  convertDeprecatedSyntaxes = vi.fn((value: string) => value),
}: {
  globby?: ReturnType<typeof vi.fn>
  readProjectFile?: ReturnType<typeof vi.fn>
  getSplits?: ReturnType<typeof vi.fn>
  initialFileData?: ReturnType<typeof vi.fn>
  inclusions?: ReturnType<typeof vi.fn>
  tokens?: ReturnType<typeof vi.fn>
  frontMatter?: ReturnType<typeof vi.fn>
  sanitizedContent?: ReturnType<typeof vi.fn>
  searchIndex?: ReturnType<typeof vi.fn>
  brokenLinks?: ReturnType<typeof vi.fn>
  reportBrokenLinks?: ReturnType<typeof vi.fn>
  readingTime?: ReturnType<typeof vi.fn>
  frontMatterInheritance?: ReturnType<typeof vi.fn>
  versionedContentOrdering?: ReturnType<typeof vi.fn>
  convertDeprecatedSyntaxes?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  vi.doMock('globby', () => ({
    globby,
  }))
  vi.doMock('../constants.js', () => ({
    ROOT_DIR: '/project',
  }))
  vi.doMock('./file-cache.js', () => ({
    FileCache: {
      readProjectFile,
    },
  }))
  vi.doMock('./config-cache.js', () => ({
    ConfigCache: {
      getRoot: vi.fn((root: string) => root),
      getSplits,
    },
  }))
  vi.doMock('../compute/markdown.js', () => ({
    MarkdownCompute: {
      initialFileData,
      inclusions,
      tokens,
      frontMatter,
      sanitizedContent,
      searchIndex,
      brokenLinks,
      reportBrokenLinks,
      readingTime,
    },
  }))
  vi.doMock('../compute/metadata.js', () => ({
    MetadataCompute: {
      frontMatterInheritance,
      versionedContentOrdering,
    },
  }))
  vi.doMock('../compute/deprecation.js', () => ({
    DeprecationCompute: {
      convertDeprecatedSyntaxes,
    },
  }))

  return {
    ...(await import('./markdown-cache.js')),
    mocks: {
      globby,
      readProjectFile,
      getSplits,
      initialFileData,
      inclusions,
      tokens,
      frontMatter,
      sanitizedContent,
      searchIndex,
      brokenLinks,
      reportBrokenLinks,
      readingTime,
      frontMatterInheritance,
      versionedContentOrdering,
      convertDeprecatedSyntaxes,
    },
  }
}

describe('MarkdownCache', () => {
  beforeEach(() => {
    global.config = {
      sources: [{ root: 'docs' }, { root: 'blog' }],
    } as any
  })

  it('caches file reads and downstream markdown computations until a file is marked stale', async () => {
    const { MarkdownCache, mocks } = await importMarkdownCache({
      readProjectFile: vi.fn().mockResolvedValue('raw'),
      convertDeprecatedSyntaxes: vi.fn((value: string) => `${value}!`),
      inclusions: vi.fn().mockResolvedValue('resolved'),
      tokens: vi.fn().mockResolvedValue([{ type: 'inline', raw: 'resolved' }]),
      frontMatter: vi.fn().mockResolvedValue({ excerpt: '', title: 'Title' }),
      sanitizedContent: vi.fn().mockResolvedValue('sanitized'),
      searchIndex: vi
        .fn()
        .mockResolvedValue({ '#title': { l: 'Title', c: [] } }),
      brokenLinks: vi.fn().mockResolvedValue([{ link: '/missing.md' }]),
      readingTime: vi.fn().mockResolvedValue(12),
    })

    const cache = MarkdownCache.get('/docs/page.md')

    await expect(cache.readFromDisk()).resolves.toBe('raw!')
    await expect(cache.readFromDisk()).resolves.toBe('raw!')
    await expect(cache.resolveInclusions()).resolves.toBe('resolved')
    await expect(cache.tokenize()).resolves.toEqual([
      { type: 'inline', raw: 'resolved' },
    ])
    await expect(cache.getFrontMatter()).resolves.toEqual({
      excerpt: '',
      title: 'Title',
    })
    await expect(cache.sanitize()).resolves.toBe('sanitized')
    await expect(cache.index()).resolves.toEqual({
      '#title': { l: 'Title', c: [] },
    })
    await expect(cache.getBrokenLinks({} as any)).resolves.toEqual([
      { link: '/missing.md' },
    ])
    await expect(cache.getReadingTime()).resolves.toBe(12)

    expect(mocks.readProjectFile).toHaveBeenCalledTimes(1)
    expect(mocks.inclusions).toHaveBeenCalledWith('/docs/page.md', 'raw!', [])
    expect(mocks.frontMatter).toHaveBeenCalledWith(
      [{ type: 'inline', raw: 'resolved' }],
      {
        file: '/docs/page.md',
        folder: '/docs',
        splits: [],
      },
    )
    expect(mocks.sanitizedContent).toHaveBeenCalledWith(
      'resolved',
      [{ type: 'inline', raw: 'resolved' }],
      expect.objectContaining({
        frontMatter: { excerpt: '', title: 'Title' },
      }),
    )

    cache.payload = { stale: { old: true } }
    MarkdownCache.clearFile('/docs/page.md')

    mocks.readProjectFile.mockResolvedValueOnce('fresh')
    mocks.convertDeprecatedSyntaxes.mockImplementationOnce(
      (value: string) => `${value}?`,
    )
    mocks.inclusions.mockResolvedValueOnce('updated')
    mocks.tokens.mockResolvedValueOnce([{ type: 'inline', raw: 'updated' }])
    mocks.frontMatter.mockResolvedValueOnce({ excerpt: '', title: 'Updated' })
    mocks.sanitizedContent.mockResolvedValueOnce('sanitized-updated')

    await expect(cache.sanitize()).resolves.toBe('sanitized-updated')
    expect(mocks.readProjectFile).toHaveBeenCalledTimes(2)
  })

  it('loads files, metadata, and broken-link reports across the full cache', async () => {
    const { MarkdownCache, mocks } = await importMarkdownCache({
      globby: vi
        .fn()
        .mockResolvedValueOnce(['index.md', 'guide.md'])
        .mockResolvedValueOnce(['post.md']),
      initialFileData: vi.fn((file: string, source: { root: string }) => ({
        path: `/${source.root}/${file}`,
        data: {
          link: `/${source.root}/${file.replace(/\.md$/, '')}`,
          layout: 'docs',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          payload: {},
        },
      })),
      frontMatterInheritance: vi.fn().mockResolvedValue(undefined),
      versionedContentOrdering: vi.fn(),
      reportBrokenLinks: vi.fn().mockResolvedValue(2),
    })

    const files = await MarkdownCache.loadFiles()
    expect(Object.keys(files)).toEqual([
      '/docs/index.md',
      '/docs/guide.md',
      '/blog/post.md',
    ])

    const docs = MarkdownCache.get('/docs/index.md')
    const assets = MarkdownCache.get('/_assets/layout.md')
    vi.spyOn(docs, 'getFrontMatter').mockResolvedValue({
      excerpt: '',
      title: 'Docs',
    } as any)
    vi.spyOn(docs, 'getReadingTime').mockResolvedValue(5 as any)
    docs.payload = { docs: { loaded: true } }
    vi.spyOn(assets, 'getFrontMatter').mockResolvedValue({ excerpt: '' } as any)
    vi.spyOn(assets, 'getReadingTime').mockResolvedValue(0 as any)

    const metadataFiles = {
      '/docs/index.md': {
        frontMatter: { excerpt: '' },
        readingTime: 0,
        payload: {},
      },
      '/_assets/layout.md': {
        frontMatter: { excerpt: '' },
        readingTime: 0,
        payload: {},
      },
    } as any

    await MarkdownCache.loadMetadata(metadataFiles, {
      '/': { navigation: [] },
    } as any)

    expect(metadataFiles['/docs/index.md']).toMatchObject({
      frontMatter: { excerpt: '', title: 'Docs' },
      readingTime: 5,
      payload: { docs: { loaded: true } },
    })
    expect(metadataFiles['/_assets/layout.md']).toMatchObject({
      payload: {},
    })
    expect(mocks.frontMatterInheritance).toHaveBeenCalled()
    expect(mocks.versionedContentOrdering).toHaveBeenCalled()

    vi.spyOn(MarkdownCache, 'reportBrokenLinks')
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
    await expect(
      MarkdownCache.getAllBrokenLinks(
        { '/docs/index.md': {} as any, '/blog/post.md': {} as any },
        {} as any,
      ),
    ).resolves.toBe(3)

    const getBrokenLinks = vi
      .spyOn(MarkdownCache.get('/docs/index.md'), 'getBrokenLinks')
      .mockResolvedValue([{ link: '/missing.md' }] as any)
    await expect(
      MarkdownCache.reportBrokenLinks('/docs/index.md', {} as any),
    ).resolves.toBe(2)
    expect(getBrokenLinks).toHaveBeenCalled()
  })

  it('indexes files with an empty title fallback', async () => {
    const { MarkdownCache, mocks } = await importMarkdownCache({
      readProjectFile: vi.fn().mockResolvedValue('raw'),
      inclusions: vi.fn().mockResolvedValue('resolved'),
      tokens: vi.fn().mockResolvedValue([{ type: 'inline', raw: 'resolved' }]),
      frontMatter: vi.fn().mockResolvedValue({ excerpt: '' }),
      searchIndex: vi.fn().mockResolvedValue({}),
    })

    await MarkdownCache.get('/docs/no-title.md').index()

    expect(mocks.searchIndex).toHaveBeenCalledWith(
      [{ type: 'inline', raw: 'resolved' }],
      { title: '' },
    )
  })
})
