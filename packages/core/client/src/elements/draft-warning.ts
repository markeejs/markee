import { html, nothing } from 'lit'
import { customElement } from 'lit/decorators.js'
import { development, MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'

import './draft-warning.css'

@customElement('markee-draft-warning')
export class MarkeeDraftWarning extends MarkeeElement.with({
  stores: [state.$currentFile],
}) {
  render() {
    if (!development) return nothing
    if (!state.$currentFile.get()?.frontMatter?.draft) return nothing

    return html`
      This document is marked as <strong>draft</strong>. It will not be visible in the
      production build of this website.
    `
  }
}
