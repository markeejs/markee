import type { MarkdownFile } from '@markee/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
let ConfigCache: typeof import('../cache/config-cache.js').ConfigCache

const rssState = vi.hoisted(() => {
  const instances: {
    options: Record<string, unknown>
    item: ReturnType<typeof vi.fn>
    xml: ReturnType<typeof vi.fn>
  }[] = []

  class RSSMock {
    item = vi.fn()
    xml = vi.fn(() => '<xml />')

    constructor(public options: Record<string, unknown>) {
      instances.push({
        options,
        item: this.item,
        xml: this.xml,
      })
    }
  }

  return { instances, RSSMock }
})

vi.mock('rss', () => ({
  default: rssState.RSSMock,
}))

async function importWriteRss({
  ensureDir = vi.fn(),
  writeFile = vi.fn(),
}: {
  ensureDir?: ReturnType<typeof vi.fn>
  writeFile?: ReturnType<typeof vi.fn>
} = {}) {
  rssState.instances.length = 0
  vi.doMock('fs-extra', () => ({
    default: {
      ensureDir,
      writeFile,
    },
  }))

  return {
    ...(await import('./write-rss.js')),
    ensureDir,
    writeFile,
  }
}

describe('writeRss', () => {
  beforeEach(async () => {
    vi.resetModules()
    ;({ ConfigCache } = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js'))
    ConfigCache.reset()
    ConfigCache.config = {
      build: {},
    } as any
  })

  it('does nothing when rss feeds are not configured', async () => {
    const { writeRss, ensureDir, writeFile } = await importWriteRss()

    await expect(writeRss({} as any)).resolves.toBeUndefined()

    expect(ensureDir).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('builds feeds using folder, author, tag, and size filters', async () => {
    ConfigCache.config.build = {
      outDir: 'site',
      rss: {
        docs: {
          filter: {
            folder: '/docs',
            author: 'alice',
            tag: ['guides'],
          },
          settings: {
            site: 'https://example.com',
            title: 'Docs feed',
            size: -1,
          },
        },
        folderOnly: {
          filter: {
            folder: 'docs',
          },
          settings: {
            site: 'https://example.com',
            title: 'Folder feed',
          },
        },
        latest: {
          filter: {
            author: ['alice'],
          },
          settings: {
            site: 'https://example.com',
            title: 'Latest feed',
            size: 1,
          },
        },
      },
    } as any

    const files = {
      '/docs/one.md': {
        link: '/docs/one',
        revisionDate: '2024-01-01',
        frontMatter: {
          title: 'One',
          excerpt: 'First',
          authors: ['Alice'],
          tags: ['Guides'],
          date: '2024-01-01',
        },
      },
      '/docs/two.md': {
        link: '/docs/two',
        revisionDate: '2025-01-01',
        frontMatter: {
          title: 'Two',
          excerpt: 'Second',
          authors: ['Alice'],
          tags: ['Guides'],
          modificationDate: '2025-01-02',
        },
      },
      '/blog/three.md': {
        link: '/blog/three',
        revisionDate: '2023-01-01',
        frontMatter: {
          title: 'Three',
          authors: ['Bob'],
          tags: ['News'],
        },
      },
      '/docs/undated.md': {
        link: '/docs/undated',
        revisionDate: '2022-01-01',
        frontMatter: {
          title: 'Undated',
          excerpt: '',
          authors: ['Alice'],
          tags: ['Guides'],
        },
      },
      '/docs/no-author.md': {
        link: '/docs/no-author',
        revisionDate: '2022-01-02',
        frontMatter: {
          title: 'No Author',
          tags: ['Guides'],
        },
      },
      '/docs/zero.md': {
        link: '/docs/zero',
        frontMatter: {
          title: 'Zero',
          authors: ['Alice'],
          tags: ['Guides'],
        },
      },
      '/docs/zero-b.md': {
        link: '/docs/zero-b',
        frontMatter: {
          title: 'Zero B',
          authors: ['Alice'],
          tags: ['Guides'],
        },
      },
      '/docs/no-title.md': {
        link: '/docs/no-title',
        revisionDate: '2021-01-01',
        frontMatter: {
          authors: ['Alice'],
          tags: ['Guides'],
        },
      },
    } as unknown as Record<string, MarkdownFile>

    const { writeRss, ensureDir, writeFile } = await importWriteRss({
      ensureDir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    })

    await writeRss(files)

    expect(ensureDir).toHaveBeenCalledWith(expect.stringContaining('/site/rss'))
    expect(rssState.instances).toHaveLength(3)
    expect(rssState.instances[0]?.options).toMatchObject({
      generator: 'Markee RSS',
      site_url: 'https://example.com',
      feed_url: 'https://example.com/rss/docs.xml',
    })
    expect(rssState.instances[0]?.item).toHaveBeenCalledTimes(6)
    expect(rssState.instances[1]?.item).toHaveBeenCalledTimes(6)
    expect(rssState.instances[2]?.item).toHaveBeenCalledTimes(1)
    expect(rssState.instances[2]?.item).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Two',
        url: 'https://example.com/docs/two',
      }),
    )
    expect(rssState.instances[1]?.item).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Undated',
        date: new Date('2022-01-01'),
      }),
    )
    expect(rssState.instances[1]?.item).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Zero',
        date: new Date(0),
      }),
    )
    expect(rssState.instances[1]?.item).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Zero B',
        date: new Date(0),
      }),
    )
    expect(rssState.instances[1]?.item).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '',
      }),
    )
    expect(writeFile).toHaveBeenCalledTimes(3)
  })
})
