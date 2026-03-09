import { customElement } from 'lit/decorators.js'

import './markee-drawer.css'

const nextId = (() => {
  let i = 0
  return () => `x-drawer-${++i}`
})()

function getOrCreateId(el: HTMLElement) {
  if (el.id) return el.id
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `x-drawer-${(crypto as any).randomUUID()}`
      : nextId()
  el.id = id
  return id
}

function isPopoverSupported(): boolean {
  return typeof (HTMLElement.prototype as any).showPopover === 'function'
}

function focusFirstIn(root: HTMLElement) {
  const focusable = root.querySelector<HTMLElement>(
    [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      "[tabindex]:not([tabindex='-1'])",
    ].join(','),
  )
  ;(focusable ?? root).focus({ preventScroll: true })
}

@customElement('markee-drawer')
export class MarkeeDrawer extends HTMLElement {
  static observedAttributes = ['side']

  #initialized = false
  #observer?: MutationObserver

  #trigger!: HTMLButtonElement
  #panel!: HTMLDivElement

  get side(): 'left' | 'right' {
    const v = (this.getAttribute('side') ?? 'left').toLowerCase()
    return v === 'right' ? 'right' : 'left'
  }
  set side(v: 'left' | 'right') {
    this.setAttribute('side', v)
  }

  get open(): boolean {
    return !!this.#panel && this.#panel.matches?.(':popover-open')
  }

  set open(open: boolean) {
    if (open) this.openDrawer()
    else this.closeDrawer()
  }

  connectedCallback() {
    if (!isPopoverSupported()) {
      this.setAttribute('data-popover-unsupported', '')
      return
    }
    if (!this.#initialized) this.#init()
    this.#syncSide()
  }

  disconnectedCallback() {
    this.#observer?.disconnect()
    this.#observer = undefined
    this.#panel?.removeEventListener('focusout', this.#handleFocusOut)
    this.#panel?.removeEventListener('toggle', this.#handleToggle)
  }

  attributeChangedCallback(name: string) {
    if (!this.#initialized) return
    if (name === 'side') this.#syncSide()
  }

  openDrawer() {
    ;(this.#panel as any)?.showPopover?.()
  }

  closeDrawer() {
    ;(this.#panel as any)?.hidePopover?.()
  }

  toggleDrawer() {
    const panelAny = this.#panel as any
    if (typeof panelAny.togglePopover === 'function') {
      panelAny.togglePopover()
      return
    }
    if (this.open) {
      this.closeDrawer()
    } else {
      this.openDrawer()
    }
  }

  #init() {
    this.#initialized = true

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.setAttribute('aria-haspopup', 'dialog')

    const panel = document.createElement('div')
    panel.setAttribute('popover', 'auto')

    const nodes = Array.from(this.childNodes)
    panel.append(...nodes)
    const buttonSlots = panel.querySelectorAll<HTMLElement>('[slot="button"]')
    trigger.append(...buttonSlots)

    const panelId = getOrCreateId(panel)
    trigger.setAttribute('popovertarget', panelId)
    trigger.setAttribute('popovertargetaction', 'toggle')
    trigger.setAttribute('aria-controls', panelId)
    trigger.setAttribute('aria-expanded', 'false')

    this.append(trigger, panel)

    this.#trigger = trigger
    this.#panel = panel

    panel.addEventListener('toggle', this.#handleToggle)
    panel.addEventListener('focusout', this.#handleFocusOut)

    this.#observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const nodes = Array.from(m.addedNodes).filter(
          (node) => !(node === this.#trigger || node === this.#panel),
        )
        this.#panel.append(...nodes)
        const buttonSlots =
          this.#panel.querySelectorAll<HTMLElement>('[slot="button"]')
        this.#trigger.append(...buttonSlots)
      }
    })
    this.#observer.observe(this, { childList: true })
  }

  #syncSide() {
    this.#panel.dataset.side = this.side
  }

  #handleFocusOut = (e: FocusEvent) => {
    if (
      this.open &&
      (e.relatedTarget as HTMLElement)?.closest('markee-drawer') !== this
    ) {
      queueMicrotask(() => focusFirstIn(this.#panel))
    }
  }

  #handleToggle = (ev: Event) => {
    const anyEv = ev as any
    const newState: 'open' | 'closed' | undefined = anyEv?.newState
    const isOpen = newState ? newState === 'open' : this.open

    this.#trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    this.dispatchEvent(
      new CustomEvent('change', {
        bubbles: true,
        composed: true,
      }),
    )

    if (isOpen) {
      if (!this.#panel.hasAttribute('tabindex')) this.#panel.tabIndex = -1
      queueMicrotask(() => focusFirstIn(this.#panel))
    }
  }
}
