import type { CSSProperties } from 'react'
import type { Root } from 'react-dom/client'
import {
  countViewDeclarations,
  decodeText,
  escapeHtml,
  MAX_VIEW_HEIGHT,
  normalizeMaxHeight,
  toErrorMessage,
} from './helpers'
import { loadLikeC4Runtime } from './runtime'

class MarkeeLikeC4 extends HTMLElement {
  #root: Root | null = null
  #runId = 0

  connectedCallback() {
    if (this.#root) return
    this.#renderStatus('Loading LikeC4 runtime...')
    void this.#renderDiagram()
  }

  disconnectedCallback() {
    this.#runId++
    this.#root?.unmount()
    this.#root = null
  }

  async #renderDiagram() {
    const runId = ++this.#runId
    const encoded = this.dataset.source

    if (!encoded) {
      this.#renderError('Missing LikeC4 source.')
      return
    }

    let source = ''
    try {
      source = decodeText(encoded)
    } catch {
      this.#renderError('Could not decode LikeC4 source.')
      return
    }

    try {
      const runtime = await loadLikeC4Runtime()
      if (runId !== this.#runId) return

      const mount = document.createElement('div')
      mount.className = 'markee-likec4-root'
      this.replaceChildren(mount)
      this.#root = runtime.createRoot(mount)

      this.#root.render(
        runtime.createElement(
          'div',
          { className: 'markee-likec4-status' },
          'Rendering LikeC4 diagram...',
        ),
      )

      const likec4 = await runtime.fromSource(source)
      try {
        const errors = likec4.getErrors()
        if (errors.length) {
          const details = errors
            .map((error) => {
              const line =
                typeof error.line === 'number' ? `Line ${error.line + 1}: ` : ''
              return `${line}${error.message}`
            })
            .join('\n')

          this.#renderError(`LikeC4 parsing failed.\n${details}`)
          return
        }

        const diagrams = await likec4.diagrams()
        const requestedView = this.dataset.view
        const selectedView =
          (requestedView
            ? diagrams.find((diagram) => diagram.id === requestedView)
            : undefined) ?? diagrams[0]

        if (!selectedView?.id) {
          this.#renderError(
            'No views were found. Add a `views { ... }` section to your LikeC4 source.',
          )
          return
        }

        const model = await likec4.layoutedModel()
        const declaredViews = countViewDeclarations(source)
        const hasMultipleViews =
          declaredViews > 1 ||
          (declaredViews === 0 &&
            new Set(diagrams.map((diagram) => diagram.id)).size > 1)
        const inLightbox = Boolean(this.closest('#glightbox-body'))
        const wrappedByLightboxTrigger = Boolean(this.closest('a.glightbox'))
        const interactionsEnabled = !wrappedByLightboxTrigger
        const zoomEnabled = interactionsEnabled && this.dataset.zoom === 'true'
        const panEnabled = interactionsEnabled && this.dataset.pan === 'true'
        const maxHeight =
          normalizeMaxHeight(this.dataset.maxHeight) || MAX_VIEW_HEIGHT
        const controlsEnabled =
          interactionsEnabled &&
          hasMultipleViews &&
          (inLightbox || !wrappedByLightboxTrigger)
        const viewStyle = {
          '--likec4-view-max-height': maxHeight,
          maxHeight,
        } as CSSProperties

        const renderView = (viewId: string) => {
          if (runId !== this.#runId || !this.#root) return

          const viewProps: any = {
            viewId,
            keepAspectRatio: true,
            zoomable: zoomEnabled,
            pannable: panEnabled,
            controls: controlsEnabled,
            browser: false,
            style: inLightbox ? undefined : viewStyle,
          }

          // Let LikeC4 control panel switch between views in multi-view models.
          if (controlsEnabled) {
            viewProps.onNavigateTo = (
              nextViewId: string | null | undefined,
            ) => {
              if (!nextViewId || nextViewId === viewId) return
              renderView(nextViewId)
            }
          }

          this.#root.render(
            runtime.createElement(
              runtime.LikeC4ModelProvider,
              { likec4model: model },
              runtime.createElement(runtime.LikeC4View, viewProps),
            ),
          )
        }

        renderView(selectedView.id)
      } finally {
        await likec4.dispose().catch(() => {})
      }
    } catch (err) {
      this.#renderError(`LikeC4 rendering failed.\n${toErrorMessage(err)}`)
    }
  }

  #renderStatus(message: string) {
    this.innerHTML = `<div class="markee-likec4-status">${escapeHtml(message)}</div>`
  }

  #renderError(message: string) {
    this.#root?.unmount()
    this.#root = null
    this.innerHTML = [
      '<div class="markee-likec4-error">',
      '<strong>LikeC4 error</strong>',
      `<pre>${escapeHtml(message)}</pre>`,
      '</div>',
    ].join('')
  }
}

export function registerLikeC4Element() {
  window.customElements.define('markee-likec4', MarkeeLikeC4)
}
