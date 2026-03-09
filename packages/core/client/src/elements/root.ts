import { html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

import { MarkeeElement, development } from '@markee/runtime'
import '@markee/state'
import '@markee/elements'

import { $current, $lock } from '@markee/state/store/current.js'
import { $metadataReady, $navigation } from '@markee/state/store/metadata.js'

import '../listeners/metadata.js'
import '../listeners/preload.js'
import '../listeners/redirects.js'
import '../listeners/glightbox.js'
import '../listeners/anchors.js'
import '../listeners/code-fences.js'

import './no-files.js'
import './initial-loading.js'
import './draft-warning.js'

import '@markee/pipeline/plugins/styles'

function noDataFiles() {
  const files = Object.keys($navigation.get().files)
  return files.filter((file) => !file.startsWith('/_assets/')).length === 0
}

@customElement('markee-root')
export class MarkeeRoot extends MarkeeElement.with({
  stores: [$current, $metadataReady],
}) {
  render() {
    const { header, footer, left, right, top, main, bottom } = $current.get()

    if (development && !$metadataReady.get()) {
      return html`
        <markee-initial-loading></markee-initial-loading>
      `
    }

    if (development && $metadataReady.get() && noDataFiles()) {
      return html`
        <markee-no-files></markee-no-files>
      `
    }

    return html`
      ${
        header &&
        html`<header id="markee-header">${unsafeHTML(header)}</header>`
      }
      ${top && html`<div id="markee-section-top">${unsafeHTML(top)}</div>`}

      <div id="markee-main">
        ${
          left &&
          html`<aside id="markee-section-left">${unsafeHTML(left)}</aside>`
        }
        ${
          main &&
          html`<article id="markee-section-main">
          <markee-draft-warning></markee-draft-warning>
          ${unsafeHTML(main)}
        </article>`
        }
        ${
          right &&
          html`<aside id="markee-section-right">${unsafeHTML(right)}</aside>`
        }
      </div>

      ${
        bottom &&
        html`<div id="markee-section-bottom">${unsafeHTML(bottom)}</div>`
      }
      ${
        footer &&
        html`<footer id="markee-footer">${unsafeHTML(footer)}</footer>`
      }
    `
  }
}

$lock.set(false)
document.body.innerHTML = '<markee-root id="root"></markee-root>'
