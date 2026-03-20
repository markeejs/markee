import { afterEach, describe, expect, it, vi } from 'vitest'
import { floatingUi } from '../utils/floating-ui'
import { MarkeeHovercard, MarkeeTooltip } from './markee-popover'

const floatingSpies = {
  cleanup: vi.fn(),
}

vi.spyOn(floatingUi, 'autoUpdate').mockImplementation(
  (...[_anchor, _panel, update]: Parameters<typeof floatingUi.autoUpdate>) => {
    update()
    return floatingSpies.cleanup
  },
)
vi.spyOn(floatingUi, 'computePosition').mockImplementation(
  async (
    ...[_anchor, _panel, options]: Parameters<typeof floatingUi.computePosition>
  ) => {
    return {
      x: 10,
      y: 20,
      placement: options?.placement ?? 'bottom',
      strategy: options?.strategy ?? 'fixed',
      middlewareData: {},
    } as Awaited<ReturnType<typeof floatingUi.computePosition>>
  },
)
vi.spyOn(floatingUi, 'flip').mockImplementation(() => ({ name: 'flip' }) as any)
vi.spyOn(floatingUi, 'offset').mockImplementation(
  (value: Parameters<typeof floatingUi.offset>[0]) =>
    ({ name: 'offset', value }) as any,
)
vi.spyOn(floatingUi, 'shift').mockImplementation(
  (options: Parameters<typeof floatingUi.shift>[0]) =>
    ({ name: 'shift', options }) as any,
)

function eventWithPath(type: string, path: EventTarget[]): Event {
  const event = new Event(type, { bubbles: true, composed: true })
  Object.defineProperty(event, 'composedPath', {
    configurable: true,
    value: () => path,
  })
  return event
}

function keydown(key: string): Event {
  return Object.assign(
    new Event('keydown', { bubbles: true, composed: true }),
    {
      key,
    },
  )
}

async function flushMicrotasks() {
  await Promise.resolve()
}

function renderMarkup(markup: string) {
  document.body.innerHTML = markup
}

function getTooltip() {
  const element = document.body.querySelector('markee-tooltip')
  if (!(element instanceof MarkeeTooltip)) {
    throw new Error('markee-tooltip not found')
  }
  return element
}

function getHovercard() {
  const element = document.body.querySelector('markee-hovercard')
  if (!(element instanceof MarkeeHovercard)) {
    throw new Error('markee-hovercard not found')
  }
  return element
}

function getPanel(element: HTMLElement) {
  const panel = element.querySelector(':scope > div')
  if (!(panel instanceof HTMLDivElement)) {
    throw new Error('panel not found')
  }
  return panel
}

function getTooltipText(element: HTMLElement) {
  const text = getPanel(element).firstElementChild
  if (!(text instanceof HTMLDivElement)) {
    throw new Error('tooltip text not found')
  }
  return text
}

function getHovercardContent(element: HTMLElement) {
  const content = getPanel(element).firstElementChild
  if (!(content instanceof HTMLDivElement)) {
    throw new Error('hovercard content not found')
  }
  return content
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('markee-tooltip', () => {
  it('exposes default getters, handles empty bindings, and tolerates repeated setup calls', () => {
    renderMarkup(`<markee-tooltip></markee-tooltip>`)

    const tooltip = getTooltip()

    expect(MarkeeTooltip.observedAttributes).toContain('label')
    expect(tooltip.for).toBe('')
    expect(tooltip.label).toBe('')
    expect(tooltip.placement).toBe('top')
    expect(tooltip.disabled).toBe(false)

    tooltip.connectedCallback()
    ;(tooltip as any).startAutoUpdate()
    const anchoredPrototype = Object.getPrototypeOf(MarkeeTooltip.prototype)
    anchoredPrototype.onBindAria.call(tooltip)
    anchoredPrototype.onUnbindAria.call(tooltip)

    expect(tooltip.querySelectorAll(':scope > div')).toHaveLength(1)
    expect(floatingUi.autoUpdate).not.toHaveBeenCalled()
  })

  it('binds to anchors, manages aria, positions itself, and responds to open-close interactions', async () => {
    vi.useFakeTimers()
    const originalAddEventListener = document.addEventListener.bind(document)
    const keydownListeners: Array<(event: KeyboardEvent) => void> = []

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: any,
    ) => {
      if (type === 'keydown' && typeof listener === 'function') {
        keydownListeners.push(listener as (event: KeyboardEvent) => void)
      }
      originalAddEventListener(type, listener, options)
    }) as typeof document.addEventListener)

    renderMarkup(`
      <button id="anchor-a" aria-describedby="existing">Anchor A</button>
      <button id="anchor-b">Anchor B</button>
      <markee-tooltip for="anchor-a" label="Tip"></markee-tooltip>
    `)

    const tooltip = getTooltip()
    const anchorA = document.getElementById('anchor-a') as HTMLButtonElement
    const anchorB = document.getElementById('anchor-b') as HTMLButtonElement
    const panel = getPanel(tooltip)
    const text = getTooltipText(tooltip)

    expect(text.textContent).toBe('Tip')
    expect(panel.hidden).toBe(true)
    expect(panel.getAttribute('role')).toBe('tooltip')

    const tooltipId = panel.id
    expect(anchorA.getAttribute('aria-describedby')).toBe(
      `existing ${tooltipId}`,
    )

    anchorA.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()

    expect(keydownListeners.length).toBeGreaterThan(0)

    expect(tooltip.dataset.open).toBe('true')
    expect(panel.dataset.open).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(panel.style.position).toBe('fixed')
    expect(panel.style.left).toBe('10px')
    expect(panel.style.top).toBe('20px')
    expect(panel.dataset.placement).toBe('top')
    expect(floatingUi.autoUpdate).toHaveBeenCalledTimes(1)

    document.dispatchEvent(eventWithPath('pointerdown', [document.body]))
    expect(tooltip.dataset.open).toBe('true')

    tooltip.placement = 'bottom'
    await flushMicrotasks()
    expect(panel.dataset.placement).toBe('bottom')

    const panelChild = text
    panelChild.tabIndex = 0
    anchorA.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: panelChild }),
    )
    vi.advanceTimersByTime(201)
    expect(tooltip.dataset.open).toBe('true')

    for (const listener of keydownListeners) {
      listener(keydown('Escape') as KeyboardEvent)
    }
    expect(tooltip.dataset.open).toBe('false')
    expect(document.activeElement).toBe(anchorA)

    anchorA.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()
    tooltip.disabled = true
    expect(tooltip.dataset.open).toBe('false')

    anchorA.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()
    expect(tooltip.dataset.open).toBe('false')

    anchorA.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushMicrotasks()
    expect(tooltip.dataset.open).toBe('false')

    tooltip.disabled = false
    tooltip.for = 'anchor-b'
    tooltip.label = 'Updated'

    expect(text.textContent).toBe('Updated')
    expect(anchorA.getAttribute('aria-describedby')).toBe('existing')
    expect(anchorB.getAttribute('aria-describedby')).toBe(tooltipId)

    anchorB.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushMicrotasks()
    expect(tooltip.dataset.open).toBe('true')

    anchorB.dispatchEvent(new Event('pointerleave'))
    anchorB.dispatchEvent(new Event('pointerenter'))
    vi.advanceTimersByTime(201)
    expect(tooltip.dataset.open).toBe('true')

    anchorB.dispatchEvent(new Event('pointerleave'))
    anchorB.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    )
    vi.advanceTimersByTime(201)
    expect(tooltip.dataset.open).toBe('false')
    expect(floatingSpies.cleanup).toHaveBeenCalled()
  })

  it('handles missing anchors and teardown cleanly', async () => {
    renderMarkup(`
      <markee-tooltip for="missing" label="Tip"></markee-tooltip>
    `)

    const tooltip = getTooltip()

    tooltip.placement = 'left'
    tooltip.for = 'still-missing'
    tooltip.disabled = true

    expect(tooltip.dataset.open).toBe('false')

    document.body.removeChild(tooltip)
    document.dispatchEvent(eventWithPath('pointerdown', [document.body]))
    document.body.dispatchEvent(keydown('Escape'))

    await flushMicrotasks()
    expect(floatingUi.computePosition).not.toHaveBeenCalled()
  })

  it('tolerates rebinding when aria-describedby has already been removed', () => {
    renderMarkup(`
      <button id="anchor-old">Old</button>
      <button id="anchor-new">New</button>
      <markee-tooltip for="anchor-old" label="Tip"></markee-tooltip>
    `)

    const tooltip = getTooltip()
    const oldAnchor = document.getElementById('anchor-old') as HTMLButtonElement
    const newAnchor = document.getElementById('anchor-new') as HTMLButtonElement
    const tooltipId = getPanel(tooltip).id

    oldAnchor.removeAttribute('aria-describedby')
    tooltip.for = 'anchor-new'

    expect(oldAnchor.hasAttribute('aria-describedby')).toBe(false)
    expect(newAnchor.getAttribute('aria-describedby')).toBe(tooltipId)
  })
})

describe('markee-hovercard', () => {
  it('exposes default getters, handles empty bindings, and can reconnect without rebuilding', () => {
    renderMarkup(`<markee-hovercard></markee-hovercard>`)

    const card = getHovercard()
    const panel = getPanel(card)

    expect(MarkeeHovercard.observedAttributes).toEqual([
      'for',
      'placement',
      'disabled',
    ])
    expect(card.for).toBe('')
    expect(card.placement).toBe('bottom-start')
    expect(card.disabled).toBe(false)

    card.connectedCallback()

    expect(getPanel(card)).toBe(panel)
  })

  it('adopts content, binds aria, tracks presence, and closes on outside interactions', async () => {
    vi.useFakeTimers()
    const originalAddEventListener = document.addEventListener.bind(document)
    const keydownListeners: Array<(event: KeyboardEvent) => void> = []

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: any,
    ) => {
      if (type === 'keydown' && typeof listener === 'function') {
        keydownListeners.push(listener as (event: KeyboardEvent) => void)
      }
      originalAddEventListener(type, listener, options)
    }) as typeof document.addEventListener)

    renderMarkup(`
      <button id="card-anchor" aria-controls="external">Anchor</button>
      <markee-hovercard for="card-anchor">
        <span>Alpha</span>
        <button type="button">Action</button>
      </markee-hovercard>
    `)

    const card = getHovercard()
    const anchor = document.getElementById('card-anchor') as HTMLButtonElement
    const panel = getPanel(card)
    const content = getHovercardContent(card)
    const action = content.querySelector('button') as HTMLButtonElement

    expect(content.children).toHaveLength(2)
    expect(anchor.getAttribute('aria-haspopup')).toBe('dialog')
    expect(anchor.getAttribute('aria-controls')).toBe(`external ${panel.id}`)
    expect(panel.tabIndex).toBe(-1)

    anchor.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()

    expect(keydownListeners.length).toBeGreaterThan(0)

    expect(card.dataset.open).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(panel.dataset.placement).toBe('bottom-start')

    document.dispatchEvent(eventWithPath('pointerdown', [card]))
    expect(card.dataset.open).toBe('true')

    document.dispatchEvent(eventWithPath('pointerdown', [anchor]))
    expect(card.dataset.open).toBe('true')

    panel.dispatchEvent(new Event('pointerenter'))
    anchor.dispatchEvent(new Event('pointerleave'))
    vi.advanceTimersByTime(201)
    expect(card.dataset.open).toBe('true')

    panel.dispatchEvent(new Event('pointerleave'))
    vi.advanceTimersByTime(201)
    expect(card.dataset.open).toBe('false')

    anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushMicrotasks()
    expect(card.dataset.open).toBe('true')

    anchor.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: action }),
    )
    vi.advanceTimersByTime(201)
    expect(card.dataset.open).toBe('true')

    anchor.dispatchEvent(new Event('pointerleave'))
    anchor.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    )
    vi.advanceTimersByTime(201)
    expect(card.dataset.open).toBe('false')

    anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushMicrotasks()

    panel.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: anchor }),
    )
    vi.advanceTimersByTime(201)
    expect(card.dataset.open).toBe('true')

    panel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    panel.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    )
    vi.advanceTimersByTime(201)

    anchor.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()
    document.dispatchEvent(eventWithPath('pointerdown', [document.body]))
    expect(card.dataset.open).toBe('false')

    anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushMicrotasks()
    for (const listener of keydownListeners) {
      listener(keydown('Escape') as KeyboardEvent)
    }
    expect(card.dataset.open).toBe('false')
    expect(document.activeElement).toBe(anchor)
  })

  it('rebinds anchors, respects existing aria-haspopup, disables cleanly, and reacts to content mutations', async () => {
    vi.useFakeTimers()

    renderMarkup(`
      <button id="first-anchor">First</button>
      <button id="second-anchor" aria-haspopup="menu">Second</button>
      <markee-hovercard for="first-anchor">
        <span>Initial</span>
      </markee-hovercard>
    `)

    const card = getHovercard()
    const firstAnchor = document.getElementById(
      'first-anchor',
    ) as HTMLButtonElement
    const secondAnchor = document.getElementById(
      'second-anchor',
    ) as HTMLButtonElement
    const panel = getPanel(card)
    const content = getHovercardContent(card)

    card.for = 'second-anchor'
    expect(firstAnchor.hasAttribute('aria-controls')).toBe(false)
    expect(secondAnchor.getAttribute('aria-haspopup')).toBe('menu')
    expect(secondAnchor.getAttribute('aria-controls')).toBe(panel.id)

    secondAnchor.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()
    expect(card.dataset.open).toBe('true')

    const beforeCalls = vi.mocked(floatingUi.computePosition).mock.calls.length
    const added = document.createElement('span')
    added.textContent = 'Added later'
    card.append(added)
    await flushMicrotasks()

    expect(content.contains(added)).toBe(true)
    expect(
      vi.mocked(floatingUi.computePosition).mock.calls.length,
    ).toBeGreaterThan(beforeCalls)

    card.disabled = true
    expect(card.dataset.open).toBe('false')

    secondAnchor.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()
    expect(card.dataset.open).toBe('false')

    card.disabled = false
    card.placement = 'right-start'
    secondAnchor.dispatchEvent(new Event('pointerenter'))
    await flushMicrotasks()
    expect(panel.dataset.placement).toBe('right-start')

    document.body.removeChild(card)
    panel.dispatchEvent(new Event('pointerenter'))
    panel.dispatchEvent(new Event('pointerleave'))
    panel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    panel.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    )
    vi.advanceTimersByTime(201)

    expect(floatingSpies.cleanup).toHaveBeenCalled()
  })

  it('handles missing anchors and no-op adoption paths', async () => {
    renderMarkup(`
      <markee-hovercard for="missing"></markee-hovercard>
    `)

    const card = getHovercard()
    const panel = getPanel(card)
    const content = getHovercardContent(card)

    expect(content.children).toHaveLength(0)

    card.for = 'still-missing'
    card.placement = 'left'
    card.disabled = true

    document.dispatchEvent(eventWithPath('pointerdown', [document.body]))
    document.dispatchEvent(keydown('Escape'))

    await flushMicrotasks()
    expect(panel.hidden).toBe(true)
    expect(floatingUi.computePosition).not.toHaveBeenCalled()
  })

  it('coalesces and ignores mutation observer callbacks appropriately', async () => {
    const originalMutationObserver = globalThis.MutationObserver
    const originalQueueMicrotask = globalThis.queueMicrotask
    const queued: Array<() => void> = []
    const observers: Array<{ trigger: () => void }> = []

    class FakeMutationObserver {
      callback: MutationCallback

      constructor(callback: MutationCallback) {
        this.callback = callback
        observers.push({
          trigger: () => this.callback([], this as never),
        })
      }

      observe() {}
      disconnect() {}
    }

    globalThis.MutationObserver = FakeMutationObserver as never
    globalThis.queueMicrotask = vi.fn((callback: () => void) => {
      queued.push(callback)
    })

    try {
      renderMarkup(`
        <button id="anchor-x">Anchor</button>
        <markee-hovercard for="anchor-x">
          <span>Alpha</span>
        </markee-hovercard>
      `)

      const card = getHovercard()
      const anchor = document.getElementById('anchor-x') as HTMLButtonElement
      const content = getHovercardContent(card)

      expect(observers).toHaveLength(1)

      card.connectedCallback()
      expect(observers).toHaveLength(1)

      ;(card as any).adopting = true
      observers[0].trigger()
      expect(queued).toHaveLength(0)

      ;(card as any).adopting = false
      ;(card as any).mutationScheduled = true
      observers[0].trigger()
      expect(queued).toHaveLength(0)

      ;(card as any).mutationScheduled = false
      anchor.dispatchEvent(new Event('pointerenter'))
      await flushMicrotasks()
      queued.length = 0

      const extra = document.createElement('span')
      extra.textContent = 'Later'
      card.append(extra)
      observers[0].trigger()
      observers[0].trigger()

      expect(queued).toHaveLength(1)
      queued.shift()?.()

      expect(content.contains(extra)).toBe(true)
    } finally {
      globalThis.MutationObserver = originalMutationObserver
      globalThis.queueMicrotask = originalQueueMicrotask
    }
  })
})
