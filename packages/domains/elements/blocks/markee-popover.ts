import { customElement } from 'lit/decorators.js'
import {
  floatingUi,
  type Middleware,
  type Placement,
} from '../utils/floating-ui.js'

function isHTMLElement(node: unknown): node is HTMLElement {
  return node instanceof HTMLElement
}

function getById(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null
}

function addAriaToken(el: HTMLElement, attr: string, token: string) {
  const cur = (el.getAttribute(attr) ?? '').trim()
  const parts = cur ? cur.split(/\s+/) : []
  if (!parts.includes(token)) parts.push(token)
  el.setAttribute(attr, parts.join(' '))
}

function removeAriaToken(el: HTMLElement, attr: string, token: string) {
  const cur = (el.getAttribute(attr) ?? '').trim()
  if (!cur) return
  const parts = cur.split(/\s+/).filter((t) => t !== token)
  if (parts.length) el.setAttribute(attr, parts.join(' '))
  else el.removeAttribute(attr)
}

abstract class AnchoredFloating extends HTMLElement {
  static get observedAttributes() {
    return ['for', 'placement', 'disabled']
  }

  protected anchor!: HTMLElement
  protected panelEl!: HTMLElement

  protected open = false
  protected cleanup: (() => void) | null = null

  private pointerInsideAnchor = false
  private pointerInsidePanel = false
  private focusInsideAnchor = false
  private focusInsidePanel = false

  protected closeOnOutsidePointerDown = true
  protected closeOnEscape = true

  get for(): string {
    return this.getAttribute('for') ?? ''
  }
  set for(v: string) {
    this.setAttribute('for', v)
  }

  get placement(): Placement {
    return (
      (this.getAttribute('placement') as Placement) ?? this.defaultPlacement
    )
  }
  set placement(v: Placement) {
    this.setAttribute('placement', v)
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled')
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v)
  }

  protected abstract defaultPlacement: Placement
  protected abstract middleware(): Middleware[]

  protected abstract ensureStructure(): void

  protected abstract bindAnchorOpenClose(): void
  protected abstract unbindAnchorOpenClose(): void

  protected onBindAria(): void {}
  protected onUnbindAria(): void {}

  connectedCallback() {
    this.dataset.open = 'false'
    this.ensureStructure()
    this.bindAnchor()
  }

  disconnectedCallback() {
    this.setOpen(false)
    this.unbindAnchor()
    this.stopAutoUpdate()
    this.removeGlobalListeners()
  }

  attributeChangedCallback(name: string) {
    if (name === 'for') {
      this.unbindAnchor()
      this.bindAnchor()
      return
    }
    if (name === 'placement') {
      if (this.open) this.position()
      return
    }
    if (name === 'disabled') {
      if (this.disabled) this.setOpen(false)
      return
    }
  }

  protected bindAnchor() {
    const id = this.for.trim()
    if (!id) return
    const el = getById(id)
    if (!el) return
    this.anchor = el

    this.onBindAria()
    this.bindAnchorOpenClose()

    el.addEventListener('pointerenter', this.onAnchorPointerEnter, {
      passive: true,
    })
    el.addEventListener('pointerleave', this.onAnchorPointerLeave, {
      passive: true,
    })
    el.addEventListener('focusin', this.onAnchorFocusIn)
    el.addEventListener('focusout', this.onAnchorFocusOut)
  }

  protected unbindAnchor() {
    if (!this.anchor) return

    this.anchor.removeEventListener(
      'pointerenter',
      this.onAnchorPointerEnter as any,
    )
    this.anchor.removeEventListener(
      'pointerleave',
      this.onAnchorPointerLeave as any,
    )
    this.anchor.removeEventListener('focusin', this.onAnchorFocusIn as any)
    this.anchor.removeEventListener('focusout', this.onAnchorFocusOut as any)

    this.unbindAnchorOpenClose()
    this.onUnbindAria()

    this.pointerInsideAnchor = false
    this.focusInsideAnchor = false
  }

  protected trackPanelPresence() {
    this.panelEl.addEventListener('pointerenter', this.onPanelPointerEnter, {
      passive: true,
    })
    this.panelEl.addEventListener('pointerleave', this.onPanelPointerLeave, {
      passive: true,
    })
    this.panelEl.addEventListener('focusin', this.onPanelFocusIn)
    this.panelEl.addEventListener('focusout', this.onPanelFocusOut)
  }

  protected untrackPanelPresence() {
    this.panelEl.removeEventListener(
      'pointerenter',
      this.onPanelPointerEnter as any,
    )
    this.panelEl.removeEventListener(
      'pointerleave',
      this.onPanelPointerLeave as any,
    )
    this.panelEl.removeEventListener('focusin', this.onPanelFocusIn as any)
    this.panelEl.removeEventListener('focusout', this.onPanelFocusOut as any)
  }

  protected setOpen(next: boolean) {
    if (this.disabled && next) return
    if (this.open === next) return
    this.open = next

    this.dataset.open = next ? 'true' : 'false'
    ;(this.panelEl as HTMLElement).dataset.open = next ? 'true' : 'false'
    ;(this.panelEl as HTMLElement).hidden = !next

    if (next) {
      this.addGlobalListeners()
      this.startAutoUpdate()
      queueMicrotask(() => this.position())
    } else {
      this.stopAutoUpdate()
      this.removeGlobalListeners()
      this.pointerInsidePanel = false
      this.focusInsidePanel = false
    }
  }

  protected maybeClose() {
    setTimeout(() => {
      if (
        this.pointerInsideAnchor ||
        this.pointerInsidePanel ||
        this.focusInsideAnchor ||
        this.focusInsidePanel
      )
        return
      this.setOpen(false)
    }, 200)
  }

  protected startAutoUpdate() {
    this.stopAutoUpdate()
    if (!this.anchor) return
    this.cleanup = floatingUi.autoUpdate(this.anchor, this.panelEl, () =>
      this.position(),
    )
  }

  protected stopAutoUpdate() {
    this.cleanup?.()
    this.cleanup = null
  }

  protected async position() {
    if (!this.anchor || !this.open) return

    const { x, y, placement, strategy } = await floatingUi.computePosition(
      this.anchor,
      this.panelEl,
      {
        placement: this.placement,
        middleware: this.middleware(),
        strategy: 'fixed',
      },
    )

    Object.assign((this.panelEl as HTMLElement).style, {
      position: strategy,
      left: `${x}px`,
      top: `${y}px`,
    })
    ;(this.panelEl as HTMLElement).dataset.placement = placement
    ;(this.panelEl as HTMLElement).dataset.strategy = strategy
  }

  private onAnchorPointerEnter = () => {
    if (this.disabled) return
    this.pointerInsideAnchor = true
  }
  private onAnchorPointerLeave = () => {
    this.pointerInsideAnchor = false
    this.maybeClose()
  }
  private onAnchorFocusIn = () => {
    if (this.disabled) return
    this.focusInsideAnchor = true
  }
  private onAnchorFocusOut = (e: FocusEvent) => {
    this.focusInsideAnchor = false
    const next = e.relatedTarget
    if (isHTMLElement(next) && this.panelEl.contains(next)) return
    this.maybeClose()
  }

  private onPanelPointerEnter = () => {
    this.pointerInsidePanel = true
  }
  private onPanelPointerLeave = () => {
    this.pointerInsidePanel = false
    this.maybeClose()
  }
  private onPanelFocusIn = () => {
    this.focusInsidePanel = true
  }
  private onPanelFocusOut = (e: FocusEvent) => {
    this.focusInsidePanel = false
    const next = e.relatedTarget
    if (isHTMLElement(next) && this.anchor && this.anchor.contains(next)) return
    this.maybeClose()
  }

  private onDocPointerDown = (e: PointerEvent) => {
    if (!this.open || !this.closeOnOutsidePointerDown) return
    const path = e.composedPath() as EventTarget[]
    if (path.includes(this)) return
    if (this.anchor && path.includes(this.anchor)) return
    this.setOpen(false)
  }
  private onDocKeyDown = (e: KeyboardEvent) => {
    if (!this.open || !this.closeOnEscape) return
    if (e.key === 'Escape') {
      e.preventDefault()
      this.setOpen(false)
      this.anchor?.focus?.()
    }
  }

  private addGlobalListeners() {
    document.addEventListener('pointerdown', this.onDocPointerDown, {
      capture: true,
    })
    document.addEventListener('keydown', this.onDocKeyDown, { capture: true })
  }
  private removeGlobalListeners() {
    document.removeEventListener('pointerdown', this.onDocPointerDown, {
      capture: true,
    } as any)
    document.removeEventListener('keydown', this.onDocKeyDown, {
      capture: true,
    } as any)
  }
}

@customElement('markee-tooltip')
export class MarkeeTooltip extends AnchoredFloating {
  static get observedAttributes() {
    return [...super.observedAttributes, 'label']
  }

  protected defaultPlacement: Placement = 'top'
  protected closeOnOutsidePointerDown = false

  private readonly tooltipId = `markee-tooltip-${Math.random().toString(36).slice(2)}`
  private textEl!: HTMLDivElement

  get label(): string {
    return this.getAttribute('label') ?? ''
  }
  set label(v: string) {
    this.setAttribute('label', v)
  }

  attributeChangedCallback(name: string) {
    super.attributeChangedCallback(name)
    if (name === 'label') this.syncLabel()
  }

  protected ensureStructure() {
    if (this.panelEl) return

    const panel = document.createElement('div')
    panel.id = this.tooltipId
    panel.hidden = true
    panel.dataset.open = 'false'
    panel.setAttribute('role', 'tooltip')

    const text = document.createElement('div')
    panel.appendChild(text)

    this.appendChild(panel)

    this.panelEl = panel
    this.textEl = text

    this.syncLabel()
  }

  protected middleware(): Middleware[] {
    return [
      floatingUi.offset(6),
      floatingUi.flip(),
      floatingUi.shift({ padding: 8 }),
    ]
  }

  protected onBindAria() {
    addAriaToken(this.anchor, 'aria-describedby', this.tooltipId)
  }

  protected onUnbindAria() {
    removeAriaToken(this.anchor, 'aria-describedby', this.tooltipId)
  }

  protected bindAnchorOpenClose() {
    this.anchor.addEventListener('pointerenter', this.openFromPointer, {
      passive: true,
    })
    this.anchor.addEventListener('pointerleave', this.closeIfNotFocused, {
      passive: true,
    })
    this.anchor.addEventListener('focusin', this.openFromFocus)
    this.anchor.addEventListener('focusout', this.closeIfNotHoveredOrFocused)
  }

  protected unbindAnchorOpenClose() {
    this.anchor.removeEventListener('pointerenter', this.openFromPointer as any)
    this.anchor.removeEventListener(
      'pointerleave',
      this.closeIfNotFocused as any,
    )
    this.anchor.removeEventListener('focusin', this.openFromFocus as any)
    this.anchor.removeEventListener(
      'focusout',
      this.closeIfNotHoveredOrFocused as any,
    )
  }

  private openFromPointer = () => this.setOpen(true)
  private openFromFocus = () => this.setOpen(true)

  private closeIfNotFocused = () => {
    this.maybeClose()
  }

  private closeIfNotHoveredOrFocused = () => {
    this.maybeClose()
  }

  private syncLabel() {
    if (this.textEl) this.textEl.textContent = this.label
  }
}

@customElement('markee-hovercard')
export class MarkeeHovercard extends AnchoredFloating {
  protected defaultPlacement: Placement = 'bottom-start'

  private readonly cardId = `markee-hovercard-${Math.random().toString(36).slice(2)}`
  private contentEl!: HTMLDivElement

  private mo: MutationObserver | null = null
  private adopting = false
  private mutationScheduled = false

  connectedCallback() {
    super.connectedCallback()
    this.adoptLightDomContent()
    this.observeContentMutations()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.untrackPanelPresence()
    this.mo?.disconnect()
    this.mo = null
  }

  protected ensureStructure() {
    if (this.panelEl) return

    const panel = document.createElement('div')
    panel.id = this.cardId
    panel.hidden = true
    panel.dataset.open = 'false'
    panel.tabIndex = -1

    const content = document.createElement('div')
    panel.appendChild(content)

    this.appendChild(panel)

    this.panelEl = panel
    this.contentEl = content

    this.trackPanelPresence()
  }

  protected middleware(): Middleware[] {
    return [
      floatingUi.offset(8),
      floatingUi.flip(),
      floatingUi.shift({ padding: 10 }),
    ]
  }

  protected onBindAria() {
    if (!this.anchor.hasAttribute('aria-haspopup'))
      this.anchor.setAttribute('aria-haspopup', 'dialog')
    addAriaToken(this.anchor, 'aria-controls', this.cardId)
  }

  protected onUnbindAria() {
    removeAriaToken(this.anchor, 'aria-controls', this.cardId)
  }

  protected bindAnchorOpenClose() {
    this.anchor.addEventListener('pointerenter', this.openFromPointer, {
      passive: true,
    })
    this.anchor.addEventListener('pointerleave', this.maybeCloseFromLeave, {
      passive: true,
    })
    this.anchor.addEventListener('focusin', this.openFromFocus)
    this.anchor.addEventListener('focusout', this.maybeCloseFromFocusOut)
  }

  protected unbindAnchorOpenClose() {
    this.anchor.removeEventListener('pointerenter', this.openFromPointer as any)
    this.anchor.removeEventListener(
      'pointerleave',
      this.maybeCloseFromLeave as any,
    )
    this.anchor.removeEventListener('focusin', this.openFromFocus as any)
    this.anchor.removeEventListener(
      'focusout',
      this.maybeCloseFromFocusOut as any,
    )
  }

  private openFromPointer = () => this.setOpen(true)
  private openFromFocus = () => this.setOpen(true)

  private maybeCloseFromLeave = () => this.maybeClose()
  private maybeCloseFromFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget
    if (isHTMLElement(next) && this.panelEl.contains(next)) return
    this.maybeClose()
  }

  private observeContentMutations() {
    if (this.mo) return
    this.mo = new MutationObserver(() => {
      if (this.adopting) return
      if (this.mutationScheduled) return
      this.mutationScheduled = true
      queueMicrotask(() => {
        this.mutationScheduled = false
        this.adoptLightDomContent()
        if (this.open) this.position()
      })
    })
    this.mo.observe(this, { childList: true })
  }

  private adoptLightDomContent() {
    const nodes = Array.from(this.childNodes)
    const toMove = nodes.filter((n) => n !== this.panelEl)
    if (!toMove.length) return

    this.adopting = true
    try {
      for (const n of toMove) this.contentEl.appendChild(n)
    } finally {
      this.adopting = false
    }
  }
}
