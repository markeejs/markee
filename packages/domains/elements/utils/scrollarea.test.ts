import { afterEach, describe, expect, it, vi } from 'vitest'

import { scrollToRef } from './scrollarea'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scrollToRef', () => {
  it('does nothing when there is no matching scroll viewport', () => {
    const callbacks: FrameRequestCallback[] = []
    const requestSpy = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    const cancelSpy = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestSpy)
    vi.stubGlobal('cancelAnimationFrame', cancelSpy)

    const ref = document.createElement('div')
    ref.closest = vi.fn(() => null)

    scrollToRef(ref)
    callbacks[0](0)

    expect(cancelSpy).toHaveBeenCalledWith(0)
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('scrolls the viewport when the reference is outside the visible range', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const viewport = document.createElement('div')
    viewport.scrollTop = 0
    viewport.getBoundingClientRect = () =>
      ({ top: 100, height: 200 } as DOMRect)

    const ref = document.createElement('div')
    ref.closest = vi.fn(() => viewport)
    ref.getBoundingClientRect = () =>
      ({ top: 350, height: 20 } as DOMRect)

    scrollToRef(ref)
    callbacks[0](0)

    expect(viewport.scrollTop).toBe(160)
  })

  it('retries on zero-height viewports before settling', () => {
    const callbacks: FrameRequestCallback[] = []
    const cancelSpy = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', cancelSpy)

    let viewportHeight = 0
    const viewport = document.createElement('div')
    viewport.scrollTop = 0
    viewport.getBoundingClientRect = () =>
      ({ top: 10, height: viewportHeight } as DOMRect)

    const ref = document.createElement('div')
    ref.closest = vi.fn(() => viewport)
    ref.getBoundingClientRect = () =>
      ({ top: 10, height: 0 } as DOMRect)

    scrollToRef(ref)
    callbacks[0](0)

    expect(callbacks).toHaveLength(2)
    expect(cancelSpy).toHaveBeenLastCalledWith(1)

    viewportHeight = 100
    callbacks[1](0)

    expect(viewport.scrollTop).toBe(0)
  })
})
