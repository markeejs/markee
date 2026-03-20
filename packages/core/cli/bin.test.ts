import { describe, expect, it, vi } from 'vitest'

describe('bin', () => {
  it('loads the built CLI entrypoint', async () => {
    vi.resetModules()

    const loaded = vi.fn()
    vi.doMock('./dist/index.js', () => {
      loaded()
      return {}
    })

    // @ts-ignore - bin shim is plain JS
    await import('./bin.js')

    expect(loaded).toHaveBeenCalledTimes(1)
  })
})
