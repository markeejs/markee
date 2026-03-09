import { customElement } from 'lit/decorators.js'
import './markee-collapse.css'

@customElement('markee-collapse')
export class MarkeeCollapse extends HTMLElement {
  #initialized = false

  connectedCallback() {
    if (this.#initialized) return
    this.#initialized = true

    const nodes = Array.from(this.childNodes)
    const inner = document.createElement('div')
    inner.append(...nodes)
    this.appendChild(inner)
  }
}
