import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importWriteClient({
  clientDir = '/repo/node_modules/@markee/client',
  copy = vi.fn(),
  copyDirectory = vi.fn(),
  handleCopyError = vi.fn(() => vi.fn()),
}: {
  clientDir?: string
  copy?: ReturnType<typeof vi.fn>
  copyDirectory?: ReturnType<typeof vi.fn>
  handleCopyError?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  vi.doMock('fs-extra', () => ({
    default: {
      copy,
    },
  }))
  vi.doMock('../constants.js', async () => {
    const actual = await vi.importActual('../constants.js')
    return {
      ...actual,
      CLIENT_DIR: clientDir,
    }
  })
  vi.doMock('../helpers/filesystem.js', () => ({
    FilesystemHelpers: {
      copyDirectory,
      handleCopyError,
    },
  }))

  return {
    ...(await import('./write-client.js')),
    copy,
    copyDirectory,
    handleCopyError,
  }
}

describe('writeClient', () => {
  beforeEach(() => {
    global.config = {
      build: { outDir: 'site' },
    } as any
  })

  it('exits when the client build cannot be located', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any)
    const { writeClient, copy, copyDirectory } = await importWriteClient({
      clientDir: '.',
    })

    await writeClient()

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Impossible to find @markee/client'),
    )
    expect(exit).toHaveBeenCalledWith(1)
    expect(copy).not.toHaveBeenCalled()
    expect(copyDirectory).not.toHaveBeenCalled()
  })

  it('copies public files first and reports client asset copy errors', async () => {
    const errorHandler = vi.fn()
    const { writeClient, copy, copyDirectory, handleCopyError } =
      await importWriteClient({
        copy: vi.fn().mockRejectedValue(new Error('missing public')),
        copyDirectory: vi.fn().mockRejectedValue(new Error('copy failed')),
        handleCopyError: vi.fn(() => errorHandler),
      })

    await writeClient()

    expect(copy).toHaveBeenCalledWith(
      expect.stringContaining('/public'),
      expect.stringContaining('/site'),
    )
    expect(copyDirectory).toHaveBeenCalledWith(
      expect.stringContaining('/assets'),
      expect.stringContaining('/site'),
    )
    expect(handleCopyError).toHaveBeenCalledWith('Error copying @markee/client')
    expect(errorHandler).toHaveBeenCalled()
  })
})
