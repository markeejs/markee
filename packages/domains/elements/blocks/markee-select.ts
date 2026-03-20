import { customElement } from 'lit/decorators.js'
import { floatingUi } from '../utils/floating-ui.js'

import './markee-select.css'

@customElement('markee-option')
export class MarkeeOption extends HTMLElement {
  static get observedAttributes() {
    return ['disabled', 'selected', 'value']
  }

  get value(): string {
    return this.getAttribute('value') ?? ''
  }
  set value(v: string) {
    this.setAttribute('value', v)
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled')
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v)
  }

  get selected(): boolean {
    return this.hasAttribute('selected')
  }
  set selected(v: boolean) {
    this.toggleAttribute('selected', v)
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'option')
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1')
    this.#syncA11y()
  }

  attributeChangedCallback() {
    this.#syncA11y()
  }

  #syncA11y() {
    this.setAttribute('aria-selected', String(this.selected))
    this.setAttribute('aria-disabled', String(this.disabled))
  }
}

@customElement('markee-select')
export class MarkeeSelect extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'placeholder', 'display-html', 'disabled']
  }

  #triggerEl!: HTMLButtonElement
  #panelEl!: HTMLDivElement
  #optionsEl!: HTMLDivElement
  #valueEl!: HTMLSpanElement

  #isOpen = false
  #activeIndex = -1

  #cleanupAutoUpdate: (() => void) | null = null
  #mo: MutationObserver | null = null
  #mutationScheduled = false
  #isAdopting = false
  #droppedValue = ''

  readonly #listboxId = `markee-select-listbox-${Math.random().toString(36).slice(2)}`
  readonly #onDocPointerDown = (e: PointerEvent) =>
    this.#handleDocPointerDown(e)
  readonly #onDocKeyDown = (e: KeyboardEvent) => this.#handleDocKeyDown(e)

  get value(): string {
    return this.getAttribute('value') ?? ''
  }
  set value(v: string) {
    if (v === this.value) return
    if (v === '') this.removeAttribute('value')
    else this.setAttribute('value', v)
  }

  get placeholder(): string {
    return this.getAttribute('placeholder') ?? 'Select…'
  }
  set placeholder(v: string) {
    this.setAttribute('placeholder', v)
  }

  get displayHtml(): boolean {
    return this.hasAttribute('display-html')
  }
  set displayHtml(v: boolean) {
    this.toggleAttribute('display-html', v)
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled')
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v)
  }

  connectedCallback() {
    this.#ensureStructure()
    this.#wireEvents()

    this.#adoptDirectChildOptions()
    this.#reconcileValueAgainstOptions({ emitChange: false })
    this.#syncSelectedFlags()
    this.#renderTriggerValue()

    this.#mo = new MutationObserver((muts) => this.#onMutations(muts))
    this.#mo.observe(this, { childList: true, subtree: true })
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.#onDocPointerDown, {
      capture: true,
    } as any)
    document.removeEventListener('keydown', this.#onDocKeyDown, {
      capture: true,
    } as any)
    this.#stopAutoUpdate()
    this.#mo?.disconnect()
    this.#mo = null
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    if (!this.#triggerEl) return

    switch (name) {
      case 'disabled': {
        this.#triggerEl.toggleAttribute('disabled', this.disabled)
        break
      }
      case 'value': {
        this.#reconcileValueAgainstOptions({ emitChange: false })
        this.#syncSelectedFlags()
        this.#renderTriggerValue()
        break
      }
      case 'placeholder':
      case 'display-html': {
        this.#renderTriggerValue()
        break
      }
    }
  }

  #ensureStructure() {
    if (this.#triggerEl && this.#panelEl && this.#optionsEl) return

    this.#triggerEl = document.createElement('button')
    this.#triggerEl.type = 'button'
    this.#triggerEl.setAttribute('aria-haspopup', 'listbox')
    this.#triggerEl.setAttribute('aria-controls', this.#listboxId)
    this.#triggerEl.toggleAttribute('disabled', this.disabled)

    this.#valueEl = document.createElement('span')

    const chev = document.createElement('span')
    chev.setAttribute('aria-hidden', 'true')
    chev.textContent = '▾'

    this.#triggerEl.append(this.#valueEl, chev)

    this.#panelEl = document.createElement('div')
    this.#panelEl.id = this.#listboxId
    this.#panelEl.setAttribute('role', 'listbox')
    this.#panelEl.tabIndex = -1
    this.#panelEl.hidden = true
    this.#panelEl.dataset.open = 'false'

    this.#optionsEl = document.createElement('div')
    this.#panelEl.append(this.#optionsEl)

    this.prepend(this.#panelEl)
    this.prepend(this.#triggerEl)

    this.dataset.open = 'false'
  }

  #wireEvents() {
    this.#triggerEl.onclick = null
    this.#panelEl.onclick = null
    this.#triggerEl.onkeydown = null
    this.#panelEl.onkeydown = null

    this.#triggerEl.addEventListener('click', () => this.#toggle())
    this.#triggerEl.addEventListener('keydown', (e) =>
      this.#onTriggerKeyDown(e),
    )
    this.#panelEl.addEventListener('click', (e) => this.#onPanelClick(e))
    this.#panelEl.addEventListener('keydown', (e) => this.#onPanelKeyDown(e))

    document.addEventListener('pointerdown', this.#onDocPointerDown, {
      capture: true,
    })
    document.addEventListener('keydown', this.#onDocKeyDown, { capture: true })
  }

  #optionsDirectChildren(): MarkeeOption[] {
    return Array.from(
      this.querySelectorAll(':scope > markee-option'),
    ) as MarkeeOption[]
  }

  #optionsInPanel(): MarkeeOption[] {
    return Array.from(
      this.#optionsEl.querySelectorAll('markee-option'),
    ) as MarkeeOption[]
  }

  #options(): MarkeeOption[] {
    const inPanel = this.#optionsInPanel()
    return inPanel.length ? inPanel : this.#optionsDirectChildren()
  }

  #enabledOptions(): MarkeeOption[] {
    return this.#options().filter((o) => !o.disabled)
  }

  #adoptDirectChildOptions() {
    const direct = this.#optionsDirectChildren()
    if (!direct.length) return

    this.#isAdopting = true
    try {
      for (const opt of direct) this.#optionsEl.appendChild(opt)
    } finally {
      this.#isAdopting = false
    }
  }

  #onMutations(muts: MutationRecord[]) {
    if (this.#isAdopting) return

    const checkForDroppedValue = () => {
      if (
        this.#droppedValue &&
        this.#options().some((o) => o.value === this.#droppedValue)
      ) {
        this.value = this.#droppedValue
        this.#droppedValue = ''
      }
    }

    let relevant = false
    for (const m of muts) {
      for (const n of Array.from(m.addedNodes)) {
        if (this.#nodeLooksLikeOptionMutation(n)) {
          relevant = true
          break
        }
      }
      if (relevant) break
      for (const n of Array.from(m.removedNodes)) {
        if (this.#nodeLooksLikeOptionMutation(n)) {
          relevant = true
          break
        }
      }
      if (relevant) break
    }
    if (!relevant) {
      checkForDroppedValue()
      return
    }

    if (this.#mutationScheduled) return
    this.#mutationScheduled = true
    queueMicrotask(() => {
      this.#mutationScheduled = false

      this.#adoptDirectChildOptions()

      checkForDroppedValue()

      this.#reconcileValueAgainstOptions({ emitChange: true })
      this.#syncSelectedFlags()
      this.#renderTriggerValue()

      if (this.#isOpen) {
        this.#ensureActiveIndex()
        this.#applyActiveMarker()
        void this.#position()
      }
    })
  }

  #nodeLooksLikeOptionMutation(n: Node): boolean {
    if (!(n instanceof HTMLElement)) return false
    if (n.tagName === 'X-OPTION') return true
    return !!n.querySelector?.('markee-option')
  }

  #reconcileValueAgainstOptions(opts: { emitChange: boolean }) {
    const v = this.value
    if (!v) return
    const exists = this.#options().some((o) => o.value === v)
    if (exists) return

    this.#droppedValue = v
    this.value = ''
    if (opts.emitChange) {
      this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    }
  }

  #syncSelectedFlags() {
    const v = this.value
    for (const o of this.#options()) o.selected = o.value === v
  }

  #selectedOption(): MarkeeOption | null {
    const v = this.value
    if (!v) return null
    return this.#options().find((o) => o.value === v) ?? null
  }

  #toggle() {
    if (this.disabled) return
    if (this.#isOpen) {
      this.#close({ returnFocus: false })
    } else {
      this.#open()
    }
  }

  #open() {
    if (this.disabled) return
    this.#isOpen = true

    this.#adoptDirectChildOptions()
    this.#ensureActiveIndex()
    this.#applyActiveMarker()

    this.#panelEl.hidden = false
    this.#panelEl.dataset.open = 'true'
    this.dataset.open = 'true'
    this.#triggerEl.setAttribute('aria-expanded', 'true')

    this.#startAutoUpdate()
    this.#position()

    this.#panelEl.focus()
  }

  #close({ returnFocus = true } = {}) {
    if (!this.#isOpen) return
    this.#isOpen = false

    this.#stopAutoUpdate()
    this.#activeIndex = -1
    this.#clearActiveMarker()

    this.#panelEl.hidden = true
    this.#panelEl.dataset.open = 'false'
    this.dataset.open = 'false'
    this.#triggerEl.setAttribute('aria-expanded', 'false')

    if (returnFocus) this.#triggerEl.focus()
  }

  #startAutoUpdate() {
    this.#stopAutoUpdate()
    this.#cleanupAutoUpdate = floatingUi.autoUpdate(
      this.#triggerEl,
      this.#panelEl,
      () => this.#position(),
    )
  }

  #stopAutoUpdate() {
    this.#cleanupAutoUpdate?.()
    this.#cleanupAutoUpdate = null
  }

  async #position() {
    const { x, y, placement, strategy } = await floatingUi.computePosition(
      this.#triggerEl,
      this.#panelEl,
      {
        placement: 'bottom-start',
        middleware: [
          floatingUi.offset(6),
          floatingUi.flip(),
          floatingUi.shift({ padding: 8 }),
          floatingUi.size({
            apply: ({ rects, elements }) => {
              ;(elements.floating as HTMLElement).style.minWidth =
                `${rects.reference.width}px`
            },
          }),
        ],
      },
    )

    Object.assign(this.#panelEl.style, {
      position: strategy,
      left: `${x}px`,
      top: `${y}px`,
    })

    this.#panelEl.dataset.placement = placement
    this.#panelEl.dataset.strategy = strategy
  }

  #handleDocPointerDown(e: PointerEvent) {
    if (!this.#isOpen) return
    const path = e.composedPath() as EventTarget[]
    if (path.includes(this)) return
    this.#close({ returnFocus: false })
  }

  #handleDocKeyDown(e: KeyboardEvent) {
    if (!this.#isOpen) return
    if (e.key === 'Escape') {
      e.preventDefault()
      this.#close()
    }
  }

  #onTriggerKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (this.#isOpen) {
          this.#moveActive(+1)
        } else {
          this.#open()
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (this.#isOpen) {
          this.#moveActive(-1)
        } else {
          this.#open()
        }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (this.#isOpen) {
          this.#commitActive()
        } else {
          this.#open()
        }
        break
    }
  }

  #onPanelKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this.#moveActive(+1)
        break
      case 'ArrowUp':
        e.preventDefault()
        this.#moveActive(-1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        this.#commitActive()
        break
      case 'Escape':
        e.preventDefault()
        this.#close()
        break
    }
  }

  #onPanelClick(e: MouseEvent) {
    const target = e.composedPath()[0] as Element | undefined
    const opt = target?.closest?.('markee-option') as MarkeeOption | null
    if (!opt || opt.disabled) return
    this.#setValueFromUser(opt.value)
    this.#close()
  }

  #setValueFromUser(next: string) {
    if (next === this.value) return
    this.value = next
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    this.#syncSelectedFlags()
    this.#renderTriggerValue()
  }

  #ensureActiveIndex() {
    const enabled = this.#enabledOptions()
    if (!enabled.length) {
      this.#activeIndex = -1
      return
    }
    const selectedIdx = enabled.findIndex((o) => o.value === this.value)
    this.#activeIndex = selectedIdx >= 0 ? selectedIdx : 0
  }

  #moveActive(delta: number) {
    const enabled = this.#enabledOptions()
    if (!enabled.length) return
    const next = (this.#activeIndex + delta + enabled.length) % enabled.length
    this.#activeIndex = next
    this.#applyActiveMarker()
    enabled[this.#activeIndex]?.scrollIntoView?.({ block: 'nearest' })
  }

  #commitActive() {
    const enabled = this.#enabledOptions()
    if (this.#activeIndex < 0 || this.#activeIndex >= enabled.length) return
    this.#setValueFromUser(enabled[this.#activeIndex].value)
    this.#close()
  }

  #clearActiveMarker() {
    for (const o of this.#options()) o.removeAttribute('data-active')
  }

  #applyActiveMarker() {
    this.#clearActiveMarker()
    const enabled = this.#enabledOptions()
    const active = enabled[this.#activeIndex]
    if (active) active.setAttribute('data-active', '')
  }

  #renderTriggerValue() {
    const selected = this.#selectedOption()

    while (this.#valueEl.firstChild)
      this.#valueEl.removeChild(this.#valueEl.firstChild)

    if (!selected) {
      const span = document.createElement('span')
      span.textContent = this.placeholder
      this.#valueEl.append(span)
      return
    }

    if (this.displayHtml) {
      const span = document.createElement('span')
      span.innerHTML = selected.innerHTML
      this.#valueEl.append(span)
    } else {
      const span = document.createElement('span')
      span.textContent = (selected.textContent ?? '').trim()
      this.#valueEl.append(span)
    }
  }
}
