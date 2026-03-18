import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MarkeeScrollArea as IMarkeeScrollArea } from './markee-scroll-area'

const { MarkeeScrollArea } = await import('./markee-scroll-area')

function renderScrollArea(markup: string) {
  document.body.innerHTML = markup
  const element = document.body.querySelector('markee-scroll-area')
  if (!(element instanceof MarkeeScrollArea)) {
    throw new Error('markee-scroll-area was not rendered')
  }
  return element
}

function getScroller(element: HTMLElement) {
  const scroller = element.querySelector(':scope > div')
  if (!(scroller instanceof HTMLDivElement)) {
    throw new Error('scroller div not found')
  }
  return scroller
}

afterEach(() => {
  vi.useRealTimers()
})

describe('markee-scroll-area', () => {
  it('mounts a scroller wrapper and reuses it across reconnects', () => {
    const element = renderScrollArea(`
      <markee-scroll-area>
        <span>Alpha</span>
        <button type="button">Beta</button>
      </markee-scroll-area>
    `)

    const scroller = getScroller(element)

    expect(element.children).toHaveLength(1)
    expect(scroller.tabIndex).toBe(0)
    expect(scroller.getAttribute('role')).toBe('region')
    expect(scroller.children).toHaveLength(2)
    expect(scroller.textContent).toContain('Alpha')
    expect(scroller.textContent).toContain('Beta')

    document.body.removeChild(element)
    document.body.appendChild(element)

    expect(element.children).toHaveLength(1)
    expect(getScroller(element)).toBe(scroller)
  })

  it('activates on pointer and focus interactions and hides after delays', () => {
    vi.useFakeTimers()

    const element = renderScrollArea(`
      <markee-scroll-area>
        <span>Alpha</span>
      </markee-scroll-area>
    `)

    const scroller = getScroller(element)

    scroller.dispatchEvent(new Event('pointerenter'))
    expect(element.hasAttribute('data-active')).toBe(true)

    scroller.dispatchEvent(new Event('pointerleave'))
    vi.advanceTimersByTime(249)
    expect(element.hasAttribute('data-active')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(element.hasAttribute('data-active')).toBe(false)

    scroller.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(element.hasAttribute('data-active')).toBe(true)

    scroller.dispatchEvent(new Event('focusout', { bubbles: true }))
    vi.advanceTimersByTime(250)
    expect(element.hasAttribute('data-active')).toBe(false)
  })

  it('activates temporarily on scroll and tracks dragging state', () => {
    vi.useFakeTimers()

    const element = renderScrollArea(`
      <markee-scroll-area>
        <span>Alpha</span>
      </markee-scroll-area>
    `)

    const scroller = getScroller(element)

    scroller.dispatchEvent(new Event('scroll'))
    expect(element.hasAttribute('data-active')).toBe(true)

    vi.advanceTimersByTime(899)
    expect(element.hasAttribute('data-active')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(element.hasAttribute('data-active')).toBe(false)

    scroller.dispatchEvent(new Event('pointerdown'))
    expect(element.hasAttribute('data-dragging')).toBe(true)

    window.dispatchEvent(new Event('pointerup'))
    expect(element.hasAttribute('data-dragging')).toBe(false)
  })

  it('clears pending timers and unbinds listeners on disconnect', () => {
    vi.useFakeTimers()

    const element = renderScrollArea(`
      <markee-scroll-area>
        <span>Alpha</span>
      </markee-scroll-area>
    `)

    const scroller = getScroller(element)

    scroller.dispatchEvent(new Event('scroll'))
    expect(element.hasAttribute('data-active')).toBe(true)

    document.body.removeChild(element)
    vi.runAllTimers()

    expect(element.hasAttribute('data-active')).toBe(true)

    element.removeAttribute('data-active')
    scroller.dispatchEvent(new Event('pointerenter'))
    scroller.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('pointerup'))

    expect(element.hasAttribute('data-active')).toBe(false)
    expect(element.hasAttribute('data-dragging')).toBe(false)
  })

  it('safely handles disconnect before the element has mounted', () => {
    const element = document.createElement(
      'markee-scroll-area',
    ) as IMarkeeScrollArea

    expect(() => element.disconnectedCallback()).not.toThrow()
  })
})
