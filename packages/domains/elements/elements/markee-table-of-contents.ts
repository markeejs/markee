import { html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { state as store } from '@markee/runtime'
import { MarkeeElement } from '@markee/runtime'

import { getHeaders, type TocItem } from '../utils/table-of-contents.js'
import { scrollToRef } from '../utils/scrollarea.js'

import './markee-table-of-contents.css'

@customElement('markee-table-of-contents-entry')
export class MarkeeTableOfContentsEntry extends MarkeeElement {
  @property({ type: Object })
  entry: TocItem = {} as TocItem

  render() {
    return html`
      <li
        data-active=${this.entry.active}
        data-passed=${this.entry.passed}
        data-current=${this.entry.current}
      >
        <a href="#${this.entry.id}">${this.entry.label}</a>
        ${
          this.entry.items.length > 0
            ? html`<ul>
              ${this.entry.items.map(
                (entry) =>
                  html`<markee-table-of-contents-entry
                    .entry=${entry}
                  ></markee-table-of-contents-entry>`,
              )}
            </ul>`
            : nothing
        }
      </li>
    `
  }

  updated() {
    if (this.entry.current) {
      scrollToRef(this)
    }
  }
}

@customElement('markee-table-of-contents')
export class MarkeeTableOfContents extends MarkeeElement.with({
  role: 'navigation',
  stores: [store.$currentLoader],
}) {
  @property({ type: String, attribute: 'data-title' })
  titleString: string = 'Table of Contents'

  @property({ type: Number, attribute: 'data-depth' })
  depth?: 3 | 4 | 5 | 6

  @state()
  windowScroll = 0

  connectedCallback() {
    super.connectedCallback()
    this.windowScroll = window.scrollY
    window.addEventListener('scroll', this.#scrollHandler, { passive: true })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('scroll', this.#scrollHandler)
  }

  #scrollHandler = () => {
    this.windowScroll = window.scrollY
  }

  render() {
    const tree = getHeaders(
      this.windowScroll + window.innerHeight >=
        window.document.body.scrollHeight - 16,
      this.depth,
    )
    const title = this.titleString || ' '

    if (!tree.length) {
      return nothing
    }

    return html`
      ${title ? html`<strong>${title}</strong>` : nothing}
      <markee-scroll-area>
        <ul>
          ${tree.map(
            (entry) =>
              html`<markee-table-of-contents-entry
                .entry=${entry}
              ></markee-table-of-contents-entry>`,
          )}
        </ul>
      </markee-scroll-area>
    `
  }
}
