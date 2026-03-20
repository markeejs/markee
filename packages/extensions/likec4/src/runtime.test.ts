import { describe, expect, it, vi } from 'vitest'

async function importRuntime() {
  vi.resetModules()

  const createElement = vi.fn()
  const createRoot = vi.fn()
  const fromSource = vi.fn()
  const LikeC4ModelProvider = vi.fn()
  const LikeC4View = vi.fn()

  vi.doMock('react', () => ({
    createElement,
  }))
  vi.doMock('react-dom/client', () => ({
    createRoot,
  }))
  vi.doMock('@likec4/language-services/browser', () => ({
    fromSource,
  }))
  vi.doMock('@likec4/diagram', () => ({
    LikeC4ModelProvider,
    LikeC4View,
  }))

  return {
    ...(await import('./runtime.js')),
    mocks: {
      createElement,
      createRoot,
      fromSource,
      LikeC4ModelProvider,
      LikeC4View,
    },
  }
}

describe('@markee/likec4 runtime', () => {
  it('loads and caches the runtime dependencies', async () => {
    const { loadLikeC4Runtime, mocks } = await importRuntime()

    const first = await loadLikeC4Runtime()
    const second = await loadLikeC4Runtime()

    expect(first).toBe(second)
    expect(first.createElement).toBe(mocks.createElement)
    expect(first.createRoot).toBe(mocks.createRoot)
    expect(first.fromSource).toBe(mocks.fromSource)
    expect(first.LikeC4ModelProvider).toBe(mocks.LikeC4ModelProvider)
    expect(first.LikeC4View).toBe(mocks.LikeC4View)
  })
})
