import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importCommandBuild({
  brokenLinks = 0,
  skipLinkValidation = false,
}: {
  brokenLinks?: number
  skipLinkValidation?: boolean
} = {}) {
  vi.resetModules()

  const emptyDir = vi.fn().mockResolvedValue(undefined)
  const ensureDir = vi.fn().mockResolvedValue(undefined)
  const writeFile = vi.fn().mockResolvedValue(undefined)
  const writeJSON = vi.fn().mockResolvedValue(undefined)
  const writeAssets = vi.fn().mockResolvedValue(undefined)
  const writeClient = vi.fn().mockResolvedValue(undefined)
  const writeRss = vi.fn().mockResolvedValue(undefined)
  const writeSitemap = vi.fn().mockResolvedValue(undefined)
  const writeSplitBuilds = vi.fn().mockResolvedValue(['/_splits/docs'])
  const loadFiles = vi.fn().mockResolvedValue({
    '/docs/page.md': {
      link: '/docs/page',
      frontMatter: { excerpt: '' },
      readingTime: 0,
      layout: '',
      payload: {},
    },
  })
  const loadFolders = vi.fn().mockResolvedValue({
    '/docs': { navigation: [] },
  })
  const loadMetadata = vi.fn().mockResolvedValue(undefined)
  const getAllBrokenLinks = vi.fn().mockResolvedValue(brokenLinks)
  const searchIndex = vi.fn().mockResolvedValue({
    '/docs/page.md': { '#intro': { l: 'Intro', c: [] } },
  })
  const assets = vi.fn().mockResolvedValue({ '/asset.png': '/asset.png' })
  const layoutsDetails = vi.fn().mockResolvedValue({
    header: '/_assets/header.md',
    footer: '/_assets/footer.md',
    layouts: {
      docs: {
        top: '/_assets/layout-top.md',
        left: '/_assets/layout-left.md',
        main: '/_assets/layout-main.md',
        right: '/_assets/layout-right.md',
        bottom: '/_assets/layout-bottom.md',
      },
    },
  })
  const index = vi.fn().mockResolvedValue('<html />')
  const markdownGet = vi.fn((file: string) => ({
    sanitize: vi.fn().mockResolvedValue(`<article>${file}</article>`),
    index: vi.fn().mockResolvedValue({ '#intro': { l: 'Intro', c: [] } }),
    payload: { [file]: { loaded: true } },
  }))

  vi.doMock('fs-extra', () => ({
    default: {
      emptyDir,
      ensureDir,
      writeFile,
      writeJSON,
    },
  }))
  vi.doMock('../cache/html-cache.js', () => ({
    HtmlCache: {
      index,
    },
  }))
  vi.doMock('../cache/section-cache.js', () => ({
    SectionCache: {
      loadFolders,
    },
  }))
  vi.doMock('../cache/config-cache.js', () => ({
    ConfigCache: {
      filterConfig: vi.fn(() => ({ title: 'Docs' })),
    },
  }))
  vi.doMock('../cache/markdown-cache.js', () => ({
    MarkdownCache: {
      loadFiles,
      loadMetadata,
      getAllBrokenLinks,
      get: markdownGet,
    },
  }))
  vi.doMock('../cache/metadata-cache.js', () => ({
    MetadataCache: {
      layoutsDetails,
      assets,
      searchIndex,
    },
  }))
  vi.doMock('../writers/write-assets.js', () => ({
    writeAssets,
  }))
  vi.doMock('../writers/write-client.js', () => ({
    writeClient,
  }))
  vi.doMock('../writers/write-rss.js', () => ({
    writeRss,
  }))
  vi.doMock('../writers/write-sitemap.js', () => ({
    writeSitemap,
  }))
  vi.doMock('../writers/write-split-builds.js', () => ({
    writeSplitBuilds,
  }))

  global.config = {
    build: {
      outDir: 'site',
      skipLinkValidation,
    },
  } as any

  return {
    ...(await import('./build.js')),
    emptyDir,
    ensureDir,
    writeFile,
    writeJSON,
    writeAssets,
    writeClient,
    writeRss,
    writeSitemap,
    writeSplitBuilds,
    loadFiles,
    loadFolders,
    loadMetadata,
    getAllBrokenLinks,
    searchIndex,
    assets,
    layoutsDetails,
    index,
    markdownGet,
  }
}

describe('commandBuild', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'time').mockImplementation(() => {})
    vi.spyOn(console, 'timeEnd').mockImplementation(() => {})
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  it('builds the site and writes generated assets and metadata', async () => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any)
    const {
      commandBuild,
      emptyDir,
      ensureDir,
      writeFile,
      writeJSON,
      writeAssets,
      writeClient,
      writeRss,
      writeSitemap,
      writeSplitBuilds,
      loadFiles,
      loadFolders,
      loadMetadata,
      getAllBrokenLinks,
    } = await importCommandBuild()

    await commandBuild()

    expect(emptyDir).toHaveBeenCalledWith(expect.stringContaining('/site'))
    expect(ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/site/_markee'),
    )
    expect(loadFiles).toHaveBeenCalledTimes(1)
    expect(loadFolders).toHaveBeenCalledTimes(1)
    expect(loadMetadata).toHaveBeenCalledTimes(1)
    expect(getAllBrokenLinks).toHaveBeenCalledTimes(1)
    expect(writeAssets).toHaveBeenCalledTimes(1)
    expect(writeClient).toHaveBeenCalledTimes(1)
    expect(writeRss).toHaveBeenCalledTimes(1)
    expect(writeSitemap).toHaveBeenCalledTimes(1)
    expect(writeSplitBuilds).toHaveBeenCalledTimes(1)
    expect(writeJSON).toHaveBeenCalledWith('site/_markee/config.json', {
      title: 'Docs',
    })
    expect(writeFile).toHaveBeenCalledWith(
      'site/index.html',
      '<html />',
      'utf8',
    )
    expect(exit).not.toHaveBeenCalled()
  })

  it('stops the build on broken links unless validation is skipped', async () => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any)

    const failing = await importCommandBuild({
      brokenLinks: 1,
      skipLinkValidation: false,
    })
    await failing.commandBuild()
    expect(exit).toHaveBeenCalledWith(1)

    exit.mockClear()

    const skipped = await importCommandBuild({
      brokenLinks: 2,
      skipLinkValidation: true,
    })
    await skipped.commandBuild()
    expect(exit).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringContaining(
        'broken links. Run without build.skipLinkValidation for details.',
      ),
    )
  })
})
