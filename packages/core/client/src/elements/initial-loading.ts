import { html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { MarkeeElement } from '@markee/runtime'

import './initial-loading.css'

@customElement('markee-initial-loading')
export class MarkeeInitialLoading extends MarkeeElement {
  render() {
    return html`
      <p>
        The development server is still indexing files, it should be ready in a few
        seconds
      </p>
      <markee-preloading></markee-preloading>
    `
  }
}
