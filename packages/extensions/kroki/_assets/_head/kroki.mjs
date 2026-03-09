import { html, nothing } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { state } from '@markee/runtime'
import { MarkeeElement } from '@markee/runtime'

import { readCache, writeCache, valueCache } from '../shared/cache.mjs'
import { loadKrokiDiagram } from '../shared/kroki-resolver.mjs'

class MarkeeKroki extends MarkeeElement.with({
  stores: [state.$payload, state.$pluginConfig],
}) {
  static get properties() {
    return {
      value: { state: true },
      error: { state: true },
    }
  }

  connectedCallback() {
    super.connectedCallback()

    const content = valueCache.get(this.id)
    if (content) {
      const { serverUrl } = state.$pluginConfig.get().for('kroki')
      if (!serverUrl) {
        this.error = html`
          Please set <code>plugins.kroki.serverUrl</code> in your markee.yaml
        `
        return
      }

      const engine =
        [...this.classList].find((c) => c !== 'kroki') || 'blockdiag'

      const key = [engine, content].join(';')
      readCache(key)
        .then((value) => {
          this.value = value
        })
        .catch(async () => {
          const value = await loadKrokiDiagram(engine, serverUrl, content)
          this.value = value

          if (!value.includes('Error')) {
            void writeCache(key, value)
          }
        })
        .catch((err) => {
          this.error = String(err)
        })
    } else {
      const prerendered = state.$payload.get().for({
        plugin: 'kroki',
        element: this,
      })
      if (prerendered) {
        this.value = prerendered
      } else {
        console.log('No content for kroki', this.id)
      }
    }
  }

  render() {
    if (this.closest('#glightbox-body')) {
      return nothing
    }

    if (this.error)
      return html`<div class="markee-kroki-error">${this.error}</div>`
    if (this.value) return unsafeHTML(this.value)

    return html`
      <div class="markee-kroki-loader"><span></span>Diagram is loading</div>
    `
  }

  updated() {
    const svg = this.querySelector('svg')
    if (svg) {
      svg.style.background = ''
    }
  }
}

window.customElements.define('markee-kroki', MarkeeKroki)
