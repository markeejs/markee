import { customElement } from 'lit/decorators.js'
import { state } from '@markee/state'

import './markee-content.css'

/**
 * Scroll the page to the given hash, if present
 * @param hash - hash to scroll to
 */
function scroll(hash: string | undefined) {
  if (hash) {
    try {
      const target = document.querySelector(`[id="${hash.slice(1)}"]`)
      target?.scrollIntoView({ behavior: 'auto' })
    } catch (err) {
      void err
    }
  } else {
    window.scrollTo({ top: 0 })
  }
}

/**
 * Check all custom elements which as a `refresh` or `requestUpdate` method and call it
 */
function refresh(except: HTMLElement) {
  document.querySelectorAll('*').forEach((child) => {
    if (child === except) return
    if ('refresh' in child && typeof child.refresh === 'function') {
      child.refresh()
    }
    if ('requestUpdate' in child && typeof child.requestUpdate === 'function') {
      child.requestUpdate()
    }
  })
}

@customElement('markee-content')
export class MarkeeContent extends HTMLElement {
  #lastKey = ''
  #lastHash = ''
  #unsubscribe?: () => void
  connectedCallback() {
    this.#unsubscribe = state.$currentLoader.subscribe((data) => {
      const fragment = document
        .createRange()
        .createContextualFragment(data.data?.content as string)

      this.replaceChildren(fragment)

      if ('headingAnchors' in this.dataset) {
        const headers = document.querySelectorAll(
          'markee-content > :is(h3,h4,h5,h6)',
        )
        headers.forEach((header) => {
          if (!header.querySelector('[data-heading]')) {
            const anchor = document.createElement('a')
            anchor.dataset.heading = 'true'
            anchor.href = '#' + header.id
            anchor.innerHTML =
              this.dataset.headingAnchors || '<i class="fa-solid fa-link"></i>'
            header.appendChild(anchor)
          }
        })
      }

      refresh(this)
      if (
        this.#lastHash !== window.location.hash ||
        this.#lastKey !== data.data?.key
      ) {
        this.#lastHash = window.location.hash
        this.#lastKey = data.data?.key as string
        requestAnimationFrame(() => {
          scroll(window.location.hash)
        })
      }
    })
  }
  disconnectedCallback() {
    this.#unsubscribe?.()
  }
}
