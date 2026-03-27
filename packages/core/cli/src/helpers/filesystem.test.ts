import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
let ConfigCache: typeof import('../cache/config-cache.js').ConfigCache

type WatchCallback = (_: unknown, filename: string | null) => unknown

async function importFilesystem({
  platform = 'darwin',
  watchTreeImpl,
  execFileImpl,
  loadConfig = vi.fn(),
}: {
  platform?: string
  watchTreeImpl?: ReturnType<typeof vi.fn>
  execFileImpl?: ReturnType<typeof vi.fn>
  loadConfig?: ReturnType<typeof vi.fn>
} = {}) {
  const config = ConfigCache.config

  vi.resetModules()
  ;({ ConfigCache } = await vi.importActual<
    typeof import('../cache/config-cache.js')
  >('../cache/config-cache.js'))
  ConfigCache.reset()
  ConfigCache.config = config

  const watchTree = watchTreeImpl ?? vi.fn()
  const execFile = execFileImpl ?? vi.fn()
  const clearAll = vi.fn()
  const clearFile = vi.fn()

  vi.doMock('node:os', () => ({
    default: { platform: () => platform },
  }))
  vi.doMock('./process.js', () => ({
    ProcessHelpers: {
      execFile,
    },
  }))
  vi.doMock('./watch.js', () => ({
    WatchHelpers: {
      watchTree,
    },
  }))
  vi.doMock('../cache/bust-cache.js', () => ({
    BustCache: {
      clearAll,
      clearFile,
    },
  }))
  vi.doMock('../cache/file-cache.js', () => ({
    FileCache: {
      clearAll,
      clearFile,
    },
  }))
  vi.doMock('../cache/section-cache.js', () => ({
    SectionCache: {
      clearFile,
    },
  }))
  vi.doMock('../cache/markdown-cache.js', () => ({
    MarkdownCache: {
      clearFile,
    },
  }))
  vi.doMock('../cache/extensions-cache.js', () => ({
    ExtensionsCache: {
      clearAll,
    },
  }))
  vi.doMock('../cache/config-cache.js', async () => {
    const actual = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js')

    class MockConfigCache extends actual.ConfigCache {
      static loadConfig = loadConfig
    }

    return {
      ...actual,
      ConfigCache: MockConfigCache,
    }
  })

  const module = await import('./filesystem.js')

  return {
    ...module,
    watchTree,
    execFile,
    clearAll,
    clearFile,
    loadConfig,
  }
}

describe('FilesystemHelpers', () => {
  beforeEach(async () => {
    ;({ ConfigCache } = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js'))
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site' },
      watch: ['docs'],
    } as any
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('logs copy errors and sorts files numerically', async () => {
    const { FilesystemHelpers } = await importFilesystem()
    const error = new Error('boom')
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})

    FilesystemHelpers.handleCopyError('copy failed')(error)

    expect(stderr).toHaveBeenNthCalledWith(1, 'copy failed')
    expect(stderr).toHaveBeenNthCalledWith(2, error)
    expect(FilesystemHelpers.sortFiles('page-2.md', 'page-10.md')).toBeLessThan(
      0,
    )
  })

  it('copies directories using platform specific commands', async () => {
    const unix = await importFilesystem({ platform: 'darwin' })

    await unix.FilesystemHelpers.copyDirectory('/src', '/dest')

    expect(unix.execFile).toHaveBeenNthCalledWith(1, 'mkdir', ['-p', '/dest'])
    expect(unix.execFile).toHaveBeenNthCalledWith(2, 'cp', [
      '-R',
      '/src',
      '/dest/',
    ])

    const win = await importFilesystem({ platform: 'win32' })

    await win.FilesystemHelpers.copyDirectory('C:/src', 'C:/dest')

    const acceptExitCode = (win.execFile.mock.calls[0] as any)?.[2]
      ?.acceptExitCode as ((code: number) => boolean) | undefined

    expect(win.execFile).toHaveBeenCalledWith(
      'robocopy',
      [
        'C:/src',
        'C:/dest',
        '/IS',
        '/IT',
        '/E',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/NC',
        '/NS',
      ],
      {
        acceptExitCode: expect.any(Function),
      },
    )
    expect(acceptExitCode?.(7)).toBe(true)
    expect(acceptExitCode?.(8)).toBe(false)
  })

  it('watches the project, ignores excluded files, clears caches, reloads config, and debounces reporting', async () => {
    const rootWatcher = { close: vi.fn() }
    const docsWatcher = { close: vi.fn() }
    const watchTree = vi
      .fn()
      .mockReturnValueOnce(rootWatcher)
      .mockReturnValueOnce(docsWatcher)
    const handler = vi.fn()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { FilesystemHelpers, clearAll, clearFile, loadConfig } =
      await importFilesystem({ watchTreeImpl: watchTree, loadConfig: vi.fn() })

    const stop = FilesystemHelpers.fileWatcher(handler)
    const rootCallback = watchTree.mock.calls[0]?.[1] as WatchCallback
    const docsCallback = watchTree.mock.calls[1]?.[1] as WatchCallback

    await rootCallback(null, '.git/index')
    await rootCallback(null, 'node_modules/pkg/index.js')
    await rootCallback(null, 'site/bundle.js')
    await rootCallback(null, 'draft~')

    expect(handler).not.toHaveBeenCalled()

    const changedFiles = [
      'markee.yaml',
      '_assets/logo.svg',
      'guide-1.md',
      'guide-2.md',
      'guide-3.md',
      'guide-4.md',
      'guide-5.md',
      'guide-6.md',
      'guide-7.md',
      'guide-8.md',
      'guide-9.md',
    ]

    for (const file of changedFiles) {
      await rootCallback(null, file)
    }

    await docsCallback(null, 'nested/page.md')

    vi.advanceTimersByTime(200)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(loadConfig).toHaveBeenCalledWith(expect.any(String))
    expect(clearAll).toHaveBeenCalled()
    expect(clearFile).toHaveBeenCalledWith(
      expect.stringContaining('/guide-1.md'),
    )
    expect(clearFile).toHaveBeenCalledWith(
      expect.stringContaining('/_assets/logo.svg'),
    )
    expect(clearFile).toHaveBeenCalledWith('docs/nested/page.md')
    expect(log).toHaveBeenCalledWith('... and', 2, 'more')

    stop()

    expect(rootWatcher.close).toHaveBeenCalledTimes(1)
    expect(docsWatcher.close).toHaveBeenCalledTimes(1)
  })
})
