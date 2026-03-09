import { customElement, property } from 'lit/decorators.js'
import { MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'
import { html, nothing } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

import './markee-contribute.css'

@customElement('markee-contribute')
export class MarkeeContribute extends MarkeeElement.with({
  stores: [state.$config, state.$currentFile],
}) {
  @property({ type: String, attribute: 'data-hint' })
  hint?: string

  @property({ type: String, attribute: 'data-icon' })
  icon?: string

  @property({ type: String, attribute: 'data-label' })
  label?: string

  content?: string

  constructor() {
    super()
    if (this.innerHTML) {
      this.content = this.innerHTML
    }
  }

  render() {
    const config = state.$config.get()

    if (!config?.repository) return nothing
    if (this.dataset.root === undefined) {
      return this.renderAsFile(
        config.repository,
        config.repositoryRoot,
        state.$currentFile.get()?.key,
      )
    } else {
      return this.renderAsRoot(config.repository, config.repositoryRoot)
    }
  }
  renderAsFile(repository: string, root = '/', file = '') {
    const base =
      (repository.endsWith('/') ? repository.slice(0, -1) : repository) +
      '/' +
      (root.startsWith('/') ? root.slice(1) : root)
    const defaultContent = html`<i class="${this.icon || 'fa fa-pen'}"></i>`

    return html`
      <a
        ?data-default=${!this.content}
        title="${this.hint || 'Edit this page'}"
        target="_blank"
        rel="noopener noreferrer"
        href="${(base.endsWith('/') ? base.slice(0, -1) : base) + file}"
      >
        ${this.content ? unsafeHTML(this.content) : defaultContent}
      </a>
    `
  }
  renderAsRoot(repository: string, root = '/') {
    const base =
      (repository.endsWith('/') ? repository.slice(0, -1) : repository) +
      '/' +
      (root.startsWith('/') ? root.slice(1) : root)
    const defaultContent = html`
      <i class="${this.icon || 'si si-github'}"></i>
      <span>${this.label || base}</span>
    `

    return html`
      <a
        ?data-default=${!this.content}
        title="${this.hint || 'Edit this site'}"
        target="_blank"
        rel="noopener noreferrer"
        href="${base}"
      >
        ${this.content ? unsafeHTML(this.content) : defaultContent}
      </a>
    `
  }
}
