import { customElement } from 'lit/decorators.js'

import './markee-scroll-area.css'

@customElement('markee-scroll-area')
export class MarkeeScrollArea extends HTMLElement {
  private scroller!: HTMLDivElement
  private deactivateTimer: number | null = null

  private onScroll = () => this.activateTemporarily(900)
  private onPointerEnter = () => this.show()
  private onPointerLeave = () => this.hideSoon(250)
  private onFocusIn = () => this.show()
  private onFocusOut = () => this.hideSoon(250)

  private onPointerDown = () => this.setAttribute('data-dragging', '')
  private onPointerUp = () => this.removeAttribute('data-dragging')

  connectedCallback(): void {
    if (!this.scroller) this.mount()
    this.bind()
  }

  disconnectedCallback(): void {
    this.unbind()
    this.clearTimer()
  }

  private mount(): void {
    this.scroller = document.createElement('div')
    this.scroller.tabIndex = 0
    this.scroller.append(...this.childNodes)
    this.scroller.setAttribute('role', 'region')
    this.append(this.scroller)
  }

  private bind(): void {
    this.unbind()

    this.scroller.addEventListener('scroll', this.onScroll, { passive: true })
    this.scroller.addEventListener('pointerenter', this.onPointerEnter)
    this.scroller.addEventListener('pointerleave', this.onPointerLeave)
    this.scroller.addEventListener('focusin', this.onFocusIn)
    this.scroller.addEventListener('focusout', this.onFocusOut)

    this.scroller.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp, { passive: true })
  }

  private unbind(): void {
    if (!this.scroller) return

    this.scroller.removeEventListener('scroll', this.onScroll)
    this.scroller.removeEventListener('pointerenter', this.onPointerEnter)
    this.scroller.removeEventListener('pointerleave', this.onPointerLeave)
    this.scroller.removeEventListener('focusin', this.onFocusIn)
    this.scroller.removeEventListener('focusout', this.onFocusOut)

    this.scroller.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
  }

  private clearTimer(): void {
    if (this.deactivateTimer !== null) {
      window.clearTimeout(this.deactivateTimer)
      this.deactivateTimer = null
    }
  }

  private show(): void {
    this.setAttribute('data-active', '')
    this.clearTimer()
  }

  private hideSoon(ms: number): void {
    this.clearTimer()
    this.deactivateTimer = window.setTimeout(() => {
      this.removeAttribute('data-active')
      this.deactivateTimer = null
    }, ms)
  }

  private activateTemporarily(ms: number): void {
    this.setAttribute('data-active', '')
    this.clearTimer()
    this.deactivateTimer = window.setTimeout(() => {
      this.removeAttribute('data-active')
      this.deactivateTimer = null
    }, ms)
  }
}
