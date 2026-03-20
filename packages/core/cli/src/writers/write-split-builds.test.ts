import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importWriteSplitBuilds({
  ensureDir = vi.fn(),
  move = vi.fn(),
  writeJSON = vi.fn(),
}: {
  ensureDir?: ReturnType<typeof vi.fn>
  move?: ReturnType<typeof vi.fn>
  writeJSON?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  vi.doMock('fs-extra', () => ({
    default: {
      ensureDir,
      move,
      writeJSON,
    },
  }))

  return {
    ...(await import('./write-split-builds.js')),
    ensureDir,
    move,
    writeJSON,
  }
}

describe('writeSplitBuilds', () => {
  beforeEach(() => {
    global.config = {
      build: { outDir: 'site' },
    } as any
  })

  it('does nothing when splits are not configured', async () => {
    const { writeSplitBuilds, ensureDir, move, writeJSON } =
      await importWriteSplitBuilds()

    await expect(
      writeSplitBuilds({} as any, {} as any, {} as any),
    ).resolves.toBeUndefined()

    expect(ensureDir).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
    expect(writeJSON).not.toHaveBeenCalled()
  })

  it('moves split content, flags external navigation entries, and writes nested metadata', async () => {
    global.config.build.splits = {
      'Admin Area': 'docs',
      'Blog': '/blog',
    } as any
    vi.stubEnv('MARBLES_SPLIT_ADMIN_AREA', 'https://admin.example')

    const files = {
      '/docs/guide.md': { link: '/docs/guide' },
      '/blog/post.md': { link: '/blog/post' },
      '/home.md': { link: '/' },
    } as unknown as Record<string, MarkdownFile>
    const folders = {
      '/': {
        navigation: [{ key: '/docs', title: 'Docs' }],
        excluded: [{ key: '/docs/guide.md', title: 'Guide' }],
        versions: [{ key: '/docs', title: 'Docs v' }],
      },
      '/docs': {
        link: '/docs',
        navigation: [{ key: '/docs/guide.md', title: 'Guide' }],
      },
      '/blog': {
        link: '/blog',
        navigation: [{ key: '/blog/post.md', title: 'Post' }],
      },
    } as unknown as Record<string, SectionFile>
    const search = {
      '/docs/guide.md': { '#intro': { l: 'Intro', c: [] } },
      '/blog/post.md': { '#post': { l: 'Post', c: [] } },
      '/home.md': { '#home': { l: 'Home', c: [] } },
    } as Record<string, { [anchor: string]: { l: string; c: string[] } }>

    const { writeSplitBuilds, ensureDir, move, writeJSON } =
      await importWriteSplitBuilds({
        ensureDir: vi.fn().mockResolvedValue(undefined),
        move: vi.fn().mockResolvedValue(undefined),
        writeJSON: vi.fn().mockResolvedValue(undefined),
      })

    await expect(writeSplitBuilds(files, folders, search)).resolves.toEqual([
      'https://admin.example',
      '/_splits/blog',
    ])

    expect(folders['/']?.navigation?.[0]?.split).toBe(true)
    expect(folders['/']?.excluded?.[0]?.split).toBe(true)
    expect(folders['/']?.versions?.[0]?.split).toBe(true)
    expect(files['/docs/guide.md']).toBeUndefined()
    expect(files['/home.md']).toBeDefined()
    expect(search['/docs/guide.md']).toBeUndefined()
    expect(search._splits).toEqual(['https://admin.example', '/_splits/blog'])
    expect(move).toHaveBeenCalledWith(
      expect.stringContaining('/site/docs'),
      expect.stringContaining('/site/_splits/admin-area/docs'),
    )
    expect(move).toHaveBeenCalledWith(
      expect.stringContaining('/site/blog'),
      expect.stringContaining('/site/_splits/blog/blog'),
    )
    expect(ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/site/_splits/admin-area/_markee'),
    )
    expect(ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/site/_splits/blog/_markee'),
    )
    expect(writeJSON).toHaveBeenCalledWith(
      expect.stringContaining('/site/_splits/blog/_markee/navigation.json'),
      {
        files: {
          '/blog/post.md': {
            link: '/blog/post',
            root: '/_splits/blog',
          },
        },
        folders: {
          '/blog': {
            link: '/blog',
            navigation: [{ key: '/blog/post.md', title: 'Post' }],
          },
        },
      },
    )
    expect(writeJSON).toHaveBeenCalledWith(
      expect.stringContaining('/site/_splits/blog/_markee/search.json'),
      {
        '/blog/post.md': { '#post': { l: 'Post', c: [] } },
      },
    )
    expect(writeJSON).toHaveBeenCalledWith(
      expect.stringContaining('/navigation.json'),
      {
        files: {
          '/docs/guide.md': {
            link: '/docs/guide',
            root: 'https://admin.example',
          },
        },
        folders: {
          '/docs': {
            link: '/docs',
            navigation: [{ key: '/docs/guide.md', title: 'Guide' }],
          },
        },
      },
    )
    expect(writeJSON).toHaveBeenCalledWith(
      expect.stringContaining('/search.json'),
      {
        '/docs/guide.md': { '#intro': { l: 'Intro', c: [] } },
      },
    )
  })
})
