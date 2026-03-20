import { beforeEach, describe, expect, it, vi } from 'vitest'

const hotReloadState = vi.hoisted(() => ({
  clearCache: vi.fn(),
  revalidateMetadata: vi.fn(),
  now: 1_000,
  raf: undefined as undefined | FrameRequestCallback,
  hidden: false,
  fetchQueue: [] as Array<any[]>,
  eventSources: [] as FakeEventSource[],
}))

vi.mock('@markee/state/cache.js', () => ({
  clearCache: hotReloadState.clearCache,
}))

vi.mock('@markee/state/store/metadata.js', () => ({
  revalidateMetadata: hotReloadState.revalidateMetadata,
}))

class FakeEventSource {
  listeners = new Map<string, Array<() => void>>()
  close = vi.fn()

  constructor(public readonly url: string) {
    hotReloadState.eventSources.push(this)
  }

  addEventListener(type: string, callback: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback])
  }

  dispatch(type: string) {
    for (const callback of this.listeners.get(type) ?? []) {
      callback()
    }
  }
}

function flush() {
  return Promise.resolve().then(() => Promise.resolve())
}

describe('hot-reload listener', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.unstubAllGlobals()
    hotReloadState.clearCache.mockClear()
    hotReloadState.revalidateMetadata.mockClear()
    hotReloadState.now = 1_000
    hotReloadState.raf = undefined
    hotReloadState.hidden = false
    hotReloadState.fetchQueue = []
    hotReloadState.eventSources = []
    document.head.innerHTML = ''
    document.body.innerHTML = ''

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hotReloadState.hidden,
    })
    ;(globalThis as any).EventSource = FakeEventSource
    vi.spyOn(Date, 'now').mockImplementation(() => hotReloadState.now)
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (callback) => {
        hotReloadState.raf = callback
        return 1
      },
    )
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        ({
          json: async () => hotReloadState.fetchQueue.shift() ?? [],
        }) as Response,
    )
  })

  it('manages the event source lifecycle, revalidates on file changes, reconnects on errors, and closes when hidden', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('./hot-reload.js')

    expect(hotReloadState.eventSources).toHaveLength(1)
    expect(hotReloadState.eventSources[0].url).toBe('/_markee/sse')

    hotReloadState.eventSources[0].dispatch('fileChange')
    await flush()
    expect(hotReloadState.clearCache).toHaveBeenCalledTimes(1)
    expect(hotReloadState.revalidateMetadata).toHaveBeenCalledTimes(1)

    hotReloadState.eventSources[0].dispatch('error')
    expect(hotReloadState.eventSources[0].close).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('Hot-reload disconnected. Reconnecting...')
    window.dispatchEvent(new Event('beforeunload'))
    await vi.advanceTimersByTimeAsync(500)
    expect(hotReloadState.eventSources).toHaveLength(2)

    hotReloadState.hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(hotReloadState.eventSources[1].close).toHaveBeenCalledTimes(1)

    hotReloadState.hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(hotReloadState.eventSources).toHaveLength(3)
    window.dispatchEvent(new Event('beforeunload'))
    expect(hotReloadState.eventSources[2].close).toHaveBeenCalledTimes(1)
  })

  it('loads and revalidates dynamic head content, including module scripts, classic scripts, styles, and html fragments', async () => {
    hotReloadState.hidden = true
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    hotReloadState.fetchQueue.push(
      [
        { key: '/assets/module.js', kind: 'script', html: '', modified: 123 },
        { key: '/assets/legacy.cjs', kind: 'script', html: '' },
        { key: '/assets/app.css', kind: 'style', html: '' },
        { key: 'meta-1', kind: 'meta', html: '<meta data-test="initial">' },
      ],
      [
        { key: '/assets/module.js', kind: 'script', html: '' },
        { key: '/assets/app.css', kind: 'style', html: '' },
        { key: 'meta-1', kind: 'meta', html: '<meta data-test="changed">' },
      ],
      [],
    )

    const module = await import('./hot-reload.js')
    const loadHeadPromise = module.loadHead()
    await flush()

    let headPromises = (window as any)[Symbol.for('markee::head-promises')]
    headPromises['/assets/module.js']()
    ;(
      document.querySelector(
        '[data-key="/assets/legacy.cjs"]',
      ) as HTMLScriptElement
    ).onload?.(new Event('load'))
    ;(
      document.querySelector('[data-key="/assets/app.css"]') as HTMLLinkElement
    ).onload?.(new Event('load'))
    await vi.advanceTimersByTimeAsync(2000)
    await loadHeadPromise

    expect(
      document.head.querySelector('[data-key="/assets/module.js"]'),
    ).not.toBeNull()
    expect(
      document.head.querySelector('[data-key="/assets/legacy.cjs"]'),
    ).not.toBeNull()
    expect(
      document.head.querySelector('[data-key="/assets/app.css"]'),
    ).not.toBeNull()
    expect(document.head.querySelector('[data-test="initial"]')).not.toBeNull()

    hotReloadState.hidden = false
    hotReloadState.now = 2_000
    document.dispatchEvent(new Event('visibilitychange'))
    hotReloadState.raf?.(0)

    headPromises = (window as any)[Symbol.for('markee::head-promises')]
    headPromises['/assets/module.js']()
    ;(
      document.querySelector('[data-key="/assets/app.css"]') as HTMLLinkElement
    ).onload?.(new Event('load'))
    await vi.advanceTimersByTimeAsync(2000)
    await flush()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(
      (
        document.querySelector(
          '[data-key="/assets/module.js"]',
        ) as HTMLScriptElement
      ).innerHTML,
    ).toContain('?ts=2000')
    expect(
      document.head.querySelector('[data-key="/assets/legacy.cjs"]'),
    ).toBeNull()

    hotReloadState.hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    hotReloadState.hidden = false
    hotReloadState.now = 3_000
    document.dispatchEvent(new Event('visibilitychange'))
    hotReloadState.raf?.(0)
    await flush()

    expect(reload).toHaveBeenCalled()
    expect(document.head.querySelector('[data-test="changed"]')).toBeNull()
  })
})
