import { describe, expect, it, vi } from 'vitest'

async function importFileCache(readFile: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  vi.doMock('fs-extra', () => ({
    default: {
      readFile,
    },
  }))

  return await import('./file-cache.js')
}

describe('FileCache', () => {
  it('caches raw file reads by key and supports clearing entries', async () => {
    const readFile = vi
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')

    const { FileCache } = await importFileCache(readFile)

    await expect(FileCache.readFile('/tmp/file.md', 'doc')).resolves.toBe(
      'first',
    )
    await expect(FileCache.readFile('/tmp/file.md', 'doc')).resolves.toBe(
      'first',
    )

    FileCache.clearFile('doc')

    await expect(FileCache.readFile('/tmp/file.md', 'doc')).resolves.toBe(
      'second',
    )

    FileCache.clearAll()
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  it('reads project files from the root directory and extension files via import resolution', async () => {
    const readFile = vi
      .fn()
      .mockResolvedValueOnce('project')
      .mockResolvedValueOnce('extension')

    const { FileCache } = await importFileCache(readFile)

    await expect(FileCache.readProjectFile('/docs/page.md')).resolves.toBe(
      'project',
    )
    await expect(
      FileCache.readProjectFile('/_assets/_extension/../../package.json'),
    ).resolves.toBe('extension')

    expect(readFile).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/docs/page.md'),
      'utf-8',
    )
    expect(readFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/package.json'),
      'utf-8',
    )
  })
})
