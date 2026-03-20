import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importWriteAssets({
  pathExists = vi.fn(),
  remove = vi.fn(),
  copyDirectory = vi.fn(),
  handleCopyError = vi.fn(() => vi.fn()),
  loadExtensionsContent = vi.fn(),
}: {
  pathExists?: ReturnType<typeof vi.fn>
  remove?: ReturnType<typeof vi.fn>
  copyDirectory?: ReturnType<typeof vi.fn>
  handleCopyError?: ReturnType<typeof vi.fn>
  loadExtensionsContent?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  vi.doMock('fs-extra', () => ({
    default: {
      pathExists,
      remove,
    },
  }))
  vi.doMock('../helpers/filesystem.js', () => ({
    FilesystemHelpers: {
      copyDirectory,
      handleCopyError,
    },
  }))
  vi.doMock('../cache/extensions-cache.js', () => ({
    ExtensionsCache: {
      loadExtensionsContent,
    },
  }))

  return {
    ...(await import('./write-assets.js')),
    pathExists,
    remove,
    copyDirectory,
    handleCopyError,
  }
}

describe('writeAssets', () => {
  beforeEach(() => {
    global.config = {
      build: { outDir: 'site' },
      sources: [{ root: 'docs' }, { root: '/blog' }],
    } as any
  })

  it('copies extension assets, flattens valid targets, warns on invalid flatten entries, and copies project assets and sources', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { writeAssets, pathExists, copyDirectory, remove } =
      await importWriteAssets({
        pathExists: vi
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true),
        copyDirectory: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        loadExtensionsContent: vi.fn(() => ({
          'scope/pkg': {
            file: '/repo/node_modules/scope/pkg/index.js',
            flatten: ['/_assets/icons', 'README.md'],
          },
          'other/ext': {
            file: '/repo/node_modules/other/ext/index.js',
          },
        })),
      })

    await writeAssets()

    expect(pathExists).toHaveBeenNthCalledWith(
      1,
      '/repo/node_modules/other/ext/_assets',
    )
    expect(pathExists).toHaveBeenNthCalledWith(
      2,
      '/repo/node_modules/scope/pkg/_assets',
    )
    expect(copyDirectory).toHaveBeenCalledWith(
      '/repo/node_modules/scope/pkg/_assets',
      expect.stringContaining('/site/_assets/_extension/scope/pkg'),
    )
    expect(copyDirectory).toHaveBeenCalledWith(
      expect.stringContaining(
        '/site/_assets/_extension/scope/pkg/_assets/icons',
      ),
      expect.stringContaining('/site/_assets'),
    )
    expect(remove).toHaveBeenCalledWith(
      expect.stringContaining(
        '/site/_assets/_extension/scope/pkg/_assets/icons',
      ),
    )
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('You can only flatten content from /_assets'),
    )
    expect(copyDirectory).toHaveBeenCalledWith(
      expect.stringContaining('/_assets'),
      expect.stringContaining('/site'),
    )
    expect(copyDirectory).toHaveBeenCalledWith(
      expect.stringContaining('/docs'),
      expect.stringContaining('/site'),
    )
    expect(copyDirectory).toHaveBeenCalledWith(
      expect.stringContaining('/blog'),
      expect.stringContaining('/site'),
    )
  })
})
