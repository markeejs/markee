import { describe, expect, it, vi } from 'vitest'

async function importWatch({
  watch = vi.fn(),
}: {
  watch?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  vi.doMock('node:fs', () => ({
    default: {
      watch,
    },
  }))

  return {
    ...(await import('./watch.js')),
    mocks: { watch },
  }
}

describe('WatchHelpers', () => {
  it('uses native recursive watching and normalizes returned paths', async () => {
    const close = vi.fn()
    const watch = vi.fn((root, options, callback) => {
      expect(root).toBe('/root')
      expect(options).toEqual({ recursive: true })

      callback('change', Buffer.from('docs\\page.md'))
      callback('rename', null)

      return { close }
    })
    const handler = vi.fn()
    const { WatchHelpers, mocks } = await importWatch({ watch })

    const watcher = WatchHelpers.watchTree('/root', handler)

    expect(mocks.watch).toHaveBeenCalledWith(
      '/root',
      { recursive: true },
      expect.any(Function),
    )
    expect(handler).toHaveBeenNthCalledWith(1, 'change', 'docs/page.md')
    expect(handler).toHaveBeenNthCalledWith(2, 'rename', null)

    watcher.close()
    expect(close).toHaveBeenCalledTimes(1)
  })
})
