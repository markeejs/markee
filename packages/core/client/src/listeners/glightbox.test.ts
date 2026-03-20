import { beforeEach, describe, expect, it, vi } from 'vitest'

const glightboxState = vi.hoisted(() => ({
  factory: vi.fn(),
  openAt: vi.fn(),
  destroy: vi.fn(),
  observed: vi.fn(),
}))

vi.mock('glightbox', () => ({
  default: glightboxState.factory,
}))

class FakeMutationObserver {
  constructor(_: () => void) {}
  observe(...args: any[]) {
    glightboxState.observed(...args)
  }
}

describe('glightbox listener', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    glightboxState.factory.mockReset()
    glightboxState.openAt.mockReset()
    glightboxState.destroy.mockReset()
    glightboxState.observed.mockClear()
    glightboxState.factory.mockReturnValue({
      openAt: glightboxState.openAt,
      destroy: glightboxState.destroy,
    })
    ;(globalThis as any).MutationObserver = FakeMutationObserver
    document.body.innerHTML = ''
  })

  it('installs a mutation observer and opens matched anchors through glightbox', async () => {
    const module = await import('./glightbox.js')

    expect(glightboxState.observed).toHaveBeenCalledWith(document.body, {
      childList: true,
      subtree: true,
    })

    document.body.innerHTML = `
      <a class="glightbox" href="#first"></a>
      <a class="glightbox" href="#second"></a>
    `

    module.applyGlightbox()
    await vi.runAllTimersAsync()

    expect(glightboxState.factory).toHaveBeenCalledWith({
      touchNavigation: true,
      loop: true,
      autoplayVideos: true,
    })

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stopImmediatePropagation = vi.spyOn(event, 'stopImmediatePropagation')
    const preventDefault = vi.spyOn(event, 'preventDefault')
    document
      .querySelectorAll<HTMLAnchorElement>('a.glightbox')[1]
      .dispatchEvent(event)

    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(glightboxState.openAt).toHaveBeenCalledWith(1)
  })

  it('cleans up the previous lightbox instance before creating a new one', async () => {
    const module = await import('./glightbox.js')

    document.body.innerHTML = `<a class="glightbox" href="#first"></a>`
    module.applyGlightbox()
    await vi.runAllTimersAsync()

    document.body.innerHTML = `<a class="glightbox" href="#second"></a>`
    module.applyGlightbox()
    await vi.runAllTimersAsync()

    expect(glightboxState.destroy).toHaveBeenCalledTimes(1)
  })
})
