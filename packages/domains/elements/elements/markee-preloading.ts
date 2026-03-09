import { html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { MarkeeElement } from '@markee/runtime'

import './markee-preloading.css'

@customElement('markee-preloading')
export class MarkeePreloading extends MarkeeElement {
  render() {
    return html`
      <div></div>
      <div></div>
      <div></div>
    `
  }
}
