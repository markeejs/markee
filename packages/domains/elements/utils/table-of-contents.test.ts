import { afterEach, describe, expect, it, vi } from 'vitest'
import { state } from '@markee/state'
import { getHeaders } from './table-of-contents'

const tocState = {
  subscribers: [] as Array<(_: any) => void>,
}

const subscribeSpy = vi
  .spyOn(state.$router, 'subscribe')
  .mockImplementation((callback: (_: any) => void) => {
    tocState.subscribers.push(callback)
    return () => {}
  })

function setRect(element: Element, top: number) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ top, height: 24 }) as DOMRect,
  })
}

function createRoot(
  headers: Array<{
    tag: 'h3' | 'h4' | 'h5' | 'h6'
    id: string
    label: string
    top: number
  }>,
  headerHeight = '64px',
) {
  document.body.innerHTML = ''
  const root = document.createElement('section')
  root.id = 'markee-section-main'
  root.style.setProperty('--mk-header-height', headerHeight)

  const content = document.createElement('markee-content')
  root.append(content)

  for (const header of headers) {
    const element = document.createElement(header.tag)
    element.id = header.id
    element.textContent = header.label
    setRect(element, header.top)
    content.append(element)
  }

  document.body.append(root)
  return root
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
  window.dispatchEvent(new CustomEvent('scroll'))
})

describe('table of contents utils', () => {
  it('subscribes lazily on first render and builds classic and bottom-highlighted trees', () => {
    expect(subscribeSpy).not.toHaveBeenCalled()

    createRoot(
      [
        { tag: 'h3', id: 'intro', label: 'Intro', top: 40 },
        { tag: 'h4', id: 'intro-detail', label: 'Detail', top: 60 },
        { tag: 'h3', id: 'later', label: 'Later', top: 200 },
      ],
      '64px',
    )

    const classic = getHeaders(false, 4)
    expect(subscribeSpy).toHaveBeenCalledTimes(1)
    expect(classic).toHaveLength(2)
    expect(classic[0].active).toBe(true)
    expect(classic[0].current).toBe(false)
    expect(classic[0].items[0].active).toBe(true)
    expect(classic[0].items[0].current).toBe(true)
    expect(classic[1].active).toBe(false)

    const bottom = getHeaders(true, 4)
    expect(subscribeSpy).toHaveBeenCalledTimes(1)
    expect(bottom[1].active).toBe(true)
    expect(bottom[1].current).toBe(true)
    expect(bottom[0].passed).toBe(true)
  })

  it('marks nested items in bottom mode when the last section has children', () => {
    createRoot(
      [
        { tag: 'h3', id: 'one', label: 'One', top: 10 },
        { tag: 'h3', id: 'two', label: 'Two', top: 20 },
        { tag: 'h4', id: 'two-child', label: 'Two Child', top: 30 },
      ],
      '64px',
    )

    const bottom = getHeaders(true, 4)

    expect(bottom[1].active).toBe(true)
    expect(bottom[1].current).toBe(false)
    expect(bottom[1].items[0].active).toBe(true)
    expect(bottom[1].items[0].current).toBe(true)
  })

  it('forces highlights from hash and router changes, then clears them after scrolling', () => {
    vi.useFakeTimers()
    document.documentElement.style.fontSize = '10px'

    createRoot(
      [
        { tag: 'h3', id: 'a', label: 'Alpha', top: 400 },
        { tag: 'h4', id: 'b', label: 'Beta', top: 500 },
      ],
      '2rem',
    )

    history.replaceState({}, '', '/#b')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    let headers = getHeaders(false, 4)
    expect(headers[0].active).toBe(true)
    expect(headers[0].current).toBeUndefined()
    expect(headers[0].items[0].current).toBe(true)

    history.replaceState({}, '', '/')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    headers = getHeaders(false, 4)
    expect(headers[0].items[0].current).toBe(true)

    history.replaceState({}, '', '/')
    tocState.subscribers[0]?.({})

    headers = getHeaders(false, 4)
    expect(headers[0].items[0].current).toBe(true)

    vi.advanceTimersByTime(300)
    window.dispatchEvent(new CustomEvent('scroll'))

    headers = getHeaders(false, 4)
    expect(headers[0].active).toBe(false)
    expect(headers[0].items[0].current).toBe(false)
  })

  it('supports deeper heading levels and no-op selection when the forced id is missing', () => {
    vi.useFakeTimers()

    createRoot([
      { tag: 'h3', id: 'a', label: 'Alpha', top: 10 },
      { tag: 'h4', id: 'b', label: 'Beta', top: 20 },
      { tag: 'h5', id: 'c', label: 'Gamma', top: 30 },
      { tag: 'h6', id: 'd', label: 'Delta', top: 40 },
    ])

    history.replaceState({}, '', '/#missing')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    const headers = getHeaders(false, 6)

    expect(headers).toHaveLength(1)
    expect(headers[0].items[0].items[0].items[0].id).toBe('d')

    vi.advanceTimersByTime(300)
    window.dispatchEvent(new CustomEvent('scroll'))
  })

  it('falls back to an empty label when a heading has no text content', () => {
    const root = createRoot([
      { tag: 'h3', id: 'empty', label: 'placeholder', top: 10 },
    ])
    const header = root.querySelector('h3') as HTMLHeadingElement

    Object.defineProperty(header, 'textContent', {
      configurable: true,
      get: () => null,
    })

    const headers = getHeaders(false, 3)

    expect(headers[0].label).toBe('')
  })
})
