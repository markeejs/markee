import { beforeEach, describe, expect, it, vi } from 'vitest'

const sitemapState = vi.hoisted(() => ({
  from: vi.fn((links) => ({
    pipe: vi.fn(() => ({ links })),
  })),
  streamToPromise: vi.fn(),
  sitemapStream: vi.fn(),
}))

vi.mock('stream', () => ({
  Readable: {
    from: sitemapState.from,
  },
}))

vi.mock('sitemap', () => ({
  SitemapStream: sitemapState.sitemapStream,
  streamToPromise: sitemapState.streamToPromise,
}))

async function importWriteSitemap({
  ensureDir = vi.fn(),
  writeFile = vi.fn(),
}: {
  ensureDir?: ReturnType<typeof vi.fn>
  writeFile?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  sitemapState.from.mockClear()
  sitemapState.streamToPromise.mockClear()
  sitemapState.sitemapStream.mockClear()
  vi.doMock('fs-extra', () => ({
    default: {
      ensureDir,
      writeFile,
    },
  }))

  return {
    ...(await import('./write-sitemap.js')),
    ensureDir,
    writeFile,
  }
}

describe('writeSitemap', () => {
  beforeEach(() => {
    global.config = {
      build: { outDir: 'site' },
    } as any
  })

  it('does nothing when sitemap is not configured', async () => {
    const { writeSitemap, ensureDir, writeFile } = await importWriteSitemap()

    await writeSitemap({} as any)

    expect(ensureDir).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('writes sitemap and robots.txt when xml generation succeeds and skips writes on failure', async () => {
    const files = {
      '/docs/one.md': { link: '/docs/one', alias: ['/docs/latest'] },
    } as unknown as Record<string, MarkdownFile>

    global.config.build.sitemap = { site: 'https://example.com/docs' } as any
    sitemapState.streamToPromise.mockResolvedValueOnce(Buffer.from('<xml />'))

    const success = await importWriteSitemap({
      ensureDir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    })

    await success.writeSitemap(files)

    expect(sitemapState.sitemapStream).toHaveBeenCalledWith({
      hostname: 'https://example.com/docs',
    })
    expect(sitemapState.from).toHaveBeenCalledWith([
      '/docs/one',
      '/docs/latest',
    ])
    expect(success.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/site'),
    )
    expect(success.writeFile).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/sitemap.xml'),
      '<xml />',
      'utf-8',
    )
    expect(success.writeFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/robots.txt'),
      'Sitemap: https://example.com/docs/sitemap.xml',
    )

    sitemapState.streamToPromise.mockRejectedValueOnce(new Error('boom'))

    const failure = await importWriteSitemap({
      ensureDir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    })

    await failure.writeSitemap(files)

    expect(failure.ensureDir).not.toHaveBeenCalled()
    expect(failure.writeFile).not.toHaveBeenCalled()

    global.config.build.sitemap = { site: 'https://example.com/docs/' } as any
    sitemapState.streamToPromise.mockResolvedValueOnce(Buffer.from('<xml />'))

    const trailing = await importWriteSitemap({
      ensureDir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    })

    await trailing.writeSitemap({
      '/docs/two.md': { link: '/docs/two' },
    } as unknown as Record<string, MarkdownFile>)

    expect(sitemapState.from).toHaveBeenLastCalledWith(['/docs/two'])
    expect(trailing.writeFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/robots.txt'),
      'Sitemap: https://example.com/docs/sitemap.xml',
    )
  })
})
