import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import {
  MarkeeTableOfContents,
  MarkeeTableOfContentsEntry,
} from './markee-table-of-contents'

const currentLoaderSubscribe = vi.fn(() => () => {})

function setRect(element: Element, top: number, height = 24) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ top, height }) as DOMRect,
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

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(state.$currentLoader, 'subscribe').mockImplementation(
    currentLoaderSubscribe,
  )
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((
    callback: FrameRequestCallback,
  ) => {
    callback(0)
    return 1
  }) as typeof requestAnimationFrame)
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(
    () => undefined,
  )
})

describe('markee-table-of-contents-entry', () => {
  it('renders nested entries and scrolls the current item into view on update', async () => {
    const viewport = document.createElement('div')
    viewport.setAttribute('role', 'region')
    viewport.scrollTop = 0
    viewport.getBoundingClientRect = () =>
      ({ top: 100, height: 100 }) as DOMRect

    const scrollArea = document.createElement('markee-scroll-area')
    scrollArea.append(viewport)

    const element = new MarkeeTableOfContentsEntry()
    element.entry = {
      label: 'Intro',
      id: 'intro',
      passed: true,
      active: true,
      current: true,
      items: [
        {
          label: 'Child',
          id: 'child',
          passed: true,
          active: false,
          current: false,
          items: [],
        },
      ],
    }
    element.closest = vi.fn((selector: string) =>
      selector === 'markee-scroll-area [role="region"]' ? viewport : null,
    ) as any
    element.getBoundingClientRect = () => ({ top: 260, height: 20 }) as DOMRect

    scrollArea.append(element)
    document.body.append(scrollArea)

    await element.updateComplete

    expect(element.querySelector('li')?.dataset.active).toBe('true')
    expect(element.querySelector('li')?.dataset.current).toBe('true')
    expect(element.querySelector('a')?.getAttribute('href')).toBe('#intro')
    expect(
      element.querySelectorAll('markee-table-of-contents-entry'),
    ).toHaveLength(1)
    expect(viewport.scrollTop).toBe(120)
  })

  it('renders a leaf entry without nested markup and does not scroll non-current items', async () => {
    const element = new MarkeeTableOfContentsEntry()
    element.entry = {
      label: 'Leaf',
      id: 'leaf',
      passed: false,
      active: false,
      current: false,
      items: [],
    }

    document.body.append(element)
    await element.updateComplete

    expect(element.querySelector('ul')).toBeNull()
    expect(element.querySelector('li')?.dataset.passed).toBe('false')
  })
})

describe('markee-table-of-contents', () => {
  it('renders nothing when there are no headers', async () => {
    createRoot([])

    const element = new MarkeeTableOfContents()
    document.body.append(element)

    await element.updateComplete

    expect(element.innerHTML).toBe('<!---->')
  })

  it('renders the title and entries from the current heading tree', async () => {
    createRoot([
      { tag: 'h3', id: 'intro', label: 'Intro', top: 40 },
      { tag: 'h4', id: 'detail', label: 'Detail', top: 60 },
    ])
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(document.body, 'scrollHeight', {
      configurable: true,
      value: 1000,
    })

    const element = new MarkeeTableOfContents()
    element.titleString = ''
    element.depth = 4
    document.body.append(element)

    await element.updateComplete

    expect(currentLoaderSubscribe).toHaveBeenCalled()
    expect(element.getAttribute('aria-role')).toBe('navigation')
    expect(element.querySelector('strong')?.textContent).toBe(' ')
    expect(
      element.querySelectorAll('markee-table-of-contents-entry'),
    ).toHaveLength(2)
  })

  it('tracks window scroll on connect and removes the listener on disconnect', async () => {
    createRoot([{ tag: 'h3', id: 'intro', label: 'Intro', top: 10 }])
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 12,
      writable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(document.body, 'scrollHeight', {
      configurable: true,
      value: 1000,
    })

    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    const element = new MarkeeTableOfContents()
    document.body.append(element)
    await element.updateComplete

    expect(element.windowScroll).toBe(12)
    expect(addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { passive: true },
    )

    window.scrollY = 48
    window.dispatchEvent(new Event('scroll'))
    await element.updateComplete

    expect(element.windowScroll).toBe(48)

    element.disconnectedCallback()
    expect(removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    )
  })
})
