import { afterEach, describe, expect, it, vi } from 'vitest'

const { MarkeeDrawer } = await import('./markee-drawer')

type PopoverElement = HTMLElement & {
  showPopover?: () => void
  hidePopover?: () => void
  togglePopover?: () => void
}

const originalShowPopover = (HTMLElement.prototype as any).showPopover
const originalHidePopover = (HTMLElement.prototype as any).hidePopover
const originalTogglePopover = (HTMLElement.prototype as any).togglePopover
const originalMatches = Element.prototype.matches

function createToggleEvent(newState: 'open' | 'closed') {
  return Object.assign(new Event('toggle'), { newState })
}

function installPopoverSupport() {
  ;(HTMLElement.prototype as any).showPopover = function (this: HTMLElement) {
    this.setAttribute('data-popover-open', '')
    this.dispatchEvent(createToggleEvent('open'))
  }

  ;(HTMLElement.prototype as any).hidePopover = function (this: HTMLElement) {
    this.removeAttribute('data-popover-open')
    this.dispatchEvent(createToggleEvent('closed'))
  }

  ;(HTMLElement.prototype as any).togglePopover = function (
    this: PopoverElement,
  ) {
    if (this.matches(':popover-open')) this.hidePopover?.()
    else this.showPopover?.()
  }

  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ':popover-open') {
      return this.hasAttribute('data-popover-open')
    }
    return originalMatches.call(this, selector)
  }
}

function uninstallPopoverSupport() {
  if (originalShowPopover) {
    ;(HTMLElement.prototype as any).showPopover = originalShowPopover
  } else {
    delete (HTMLElement.prototype as any).showPopover
  }

  if (originalHidePopover) {
    ;(HTMLElement.prototype as any).hidePopover = originalHidePopover
  } else {
    delete (HTMLElement.prototype as any).hidePopover
  }

  if (originalTogglePopover) {
    ;(HTMLElement.prototype as any).togglePopover = originalTogglePopover
  } else {
    delete (HTMLElement.prototype as any).togglePopover
  }

  Element.prototype.matches = originalMatches
}

function renderDrawer(markup: string) {
  document.body.innerHTML = markup
  const element = document.body.querySelector('markee-drawer')
  if (!(element instanceof MarkeeDrawer)) {
    throw new Error('markee-drawer was not rendered')
  }
  return element
}

function getTrigger(element: HTMLElement) {
  const trigger = element.querySelector(':scope > button')
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error('drawer trigger not found')
  }
  return trigger
}

function getPanel(element: HTMLElement) {
  const panel = element.querySelector(':scope > div')
  if (!(panel instanceof HTMLDivElement)) {
    throw new Error('drawer panel not found')
  }
  return panel
}

function flushMicrotasks() {
  return Promise.resolve()
}

afterEach(() => {
  uninstallPopoverSupport()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('markee-drawer', () => {
  it('marks unsupported environments and skips initialization', () => {
    uninstallPopoverSupport()

    const element = renderDrawer(`
      <markee-drawer>
        <span>Alpha</span>
      </markee-drawer>
    `)

    expect(element.hasAttribute('data-popover-unsupported')).toBe(true)
    expect(element.querySelector('button')).toBeNull()
    expect(element.querySelector('div')).toBeNull()
  })

  it('initializes structure, generates ids, syncs side, and focuses content on open', async () => {
    installPopoverSupport()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })

    const element = renderDrawer(`
      <markee-drawer side="right">
        <span slot="button">Open</span>
        <button type="button">First action</button>
      </markee-drawer>
    `)

    const trigger = getTrigger(element)
    const panel = getPanel(element)
    const action = panel.querySelector('button')

    expect(panel.id).toBe('x-drawer-uuid-1')
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(trigger.getAttribute('popovertarget')).toBe(panel.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(panel.dataset.side).toBe('right')
    expect(trigger.textContent).toContain('Open')

    element.openDrawer()
    await flushMicrotasks()

    expect(element.open).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.tabIndex).toBe(-1)
    expect(document.activeElement).toBe(action)

    element.side = 'left'
    expect(panel.dataset.side).toBe('left')

    element.closeDrawer()
    expect(element.open).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('reuses a pre-seeded panel id when the created panel already has one', () => {
    installPopoverSupport()

    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        const el = originalCreateElement(tagName)
        if (tagName === 'div' && !el.id) el.id = 'preset-panel-id'
        return el
      }) as typeof document.createElement)

    const element = renderDrawer('<markee-drawer></markee-drawer>')
    const panel = getPanel(element)
    const trigger = getTrigger(element)

    expect(panel.id).toBe('preset-panel-id')
    expect(trigger.getAttribute('aria-controls')).toBe('preset-panel-id')
    expect(createElementSpy).toHaveBeenCalled()
  })

  it('falls back to incremental ids when randomUUID is unavailable', () => {
    installPopoverSupport()
    vi.stubGlobal('crypto', {})

    const first = renderDrawer('<markee-drawer></markee-drawer>')
    const firstId = getPanel(first).id

    document.body.innerHTML = ''

    const second = renderDrawer('<markee-drawer></markee-drawer>')
    const secondId = getPanel(second).id

    expect(firstId).toMatch(/^x-drawer-\d+$/)
    expect(secondId).toMatch(/^x-drawer-\d+$/)
    expect(Number(secondId.slice('x-drawer-'.length))).toBe(
      Number(firstId.slice('x-drawer-'.length)) + 1,
    )
  })

  it('uses togglePopover when available', () => {
    installPopoverSupport()

    const element = renderDrawer('<markee-drawer></markee-drawer>')

    const panel = getPanel(element)
    const toggleSpy = vi.spyOn(panel as PopoverElement, 'togglePopover')

    element.toggleDrawer()
    expect(toggleSpy).toHaveBeenCalledTimes(1)
    expect(element.open).toBe(true)
  })

  it('routes the open property setter to open and close methods', () => {
    installPopoverSupport()

    const element = renderDrawer(
      '<markee-drawer side=\"unknown\"></markee-drawer>',
    )
    const openSpy = vi.spyOn(element, 'openDrawer')
    const closeSpy = vi.spyOn(element, 'closeDrawer')

    expect(element.side).toBe('left')

    element.open = true
    element.open = false

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('falls back to open and close when togglePopover is unavailable', () => {
    installPopoverSupport()

    const element = renderDrawer('<markee-drawer></markee-drawer>')
    const panel = getPanel(element) as PopoverElement

    panel.togglePopover = undefined!

    const openSpy = vi.spyOn(element, 'openDrawer')
    const closeSpy = vi.spyOn(element, 'closeDrawer')

    element.toggleDrawer()
    element.toggleDrawer()

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('moves added light-dom children and slot button content into the right places', async () => {
    installPopoverSupport()

    const element = renderDrawer('<markee-drawer></markee-drawer>')
    const trigger = getTrigger(element)
    const panel = getPanel(element)

    const action = document.createElement('button')
    action.textContent = 'Action'
    const label = document.createElement('span')
    label.slot = 'button'
    label.textContent = 'Menu'

    element.append(action, label)
    await flushMicrotasks()

    expect(panel.contains(action)).toBe(true)
    expect(trigger.contains(label)).toBe(true)
  })

  it('keeps focus trapped within the open drawer and emits change on toggle events', async () => {
    installPopoverSupport()

    const element = renderDrawer(`
      <markee-drawer>
        <button type="button">Inside</button>
      </markee-drawer>
    `)

    const trigger = getTrigger(element)
    const panel = getPanel(element)
    const inside = panel.querySelector('button') as HTMLButtonElement
    const outside = document.createElement('button')
    const onChange = vi.fn()

    outside.textContent = 'Outside'
    document.body.append(outside)
    element.addEventListener('change', onChange)

    element.openDrawer()
    await flushMicrotasks()

    panel.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: outside, bubbles: true }),
    )
    await flushMicrotasks()

    expect(document.activeElement).toBe(inside)

    panel.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: trigger, bubbles: true }),
    )
    await flushMicrotasks()

    expect(document.activeElement).toBe(inside)

    panel.dispatchEvent(new Event('toggle'))
    panel.dispatchEvent(createToggleEvent('closed'))

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('disconnects observers and listeners on teardown', () => {
    installPopoverSupport()

    const disconnect = vi.fn()
    const observe = vi.fn()
    const originalMutationObserver = globalThis.MutationObserver

    class FakeMutationObserver {
      constructor(_callback: MutationCallback) {}
      observe = observe
      disconnect = disconnect
    }

    globalThis.MutationObserver = FakeMutationObserver as never

    try {
      const element = renderDrawer('<markee-drawer></markee-drawer>')
      const panel = getPanel(element)

      element.openDrawer()
      document.body.removeChild(element)
      panel.dispatchEvent(
        new FocusEvent('focusout', {
          relatedTarget: document.body,
          bubbles: true,
        }),
      )
      panel.dispatchEvent(createToggleEvent('open'))

      expect(observe).toHaveBeenCalledTimes(1)
      expect(disconnect).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.MutationObserver = originalMutationObserver
    }
  })
})
