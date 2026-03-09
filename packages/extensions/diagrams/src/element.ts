import { decodeText, escapeHtml, toErrorMessage } from './helpers'
import { loadDiagramRuntime, loadMermaid } from './runtime'

let mermaidRenderCounter = 0

class MarkeeDiagram extends HTMLElement {
  #runId = 0
  #cleanup: (() => void) | null = null

  connectedCallback() {
    this.#renderStatus('Loading diagram runtime...')
    void this.#render()
  }

  disconnectedCallback() {
    this.#runId++
    this.#cleanup?.()
    this.#cleanup = null
  }

  async #render() {
    const runId = ++this.#runId
    this.#cleanup?.()
    this.#cleanup = null

    const encoded = this.dataset.source
    const kind = this.dataset.kind?.trim()?.toLowerCase()

    if (!kind || (kind !== 'mermaid' && kind !== 'dbml')) {
      this.#renderError('Unsupported diagram type.')
      return
    }

    if (!encoded) {
      this.#renderError('Missing diagram source.')
      return
    }

    let source = ''
    try {
      source = decodeText(encoded)
    } catch {
      this.#renderError('Could not decode diagram source.')
      return
    }

    try {
      if (kind === 'mermaid') {
        const mermaid = await loadMermaid()
        if (runId !== this.#runId) return

        const output = document.createElement('div')
        output.className = 'markee-diagram-mermaid'
        this.replaceChildren(output)

        const diagramId = `markee-diagram-mermaid-${mermaidRenderCounter++}`
        const rendered = await mermaid.render(diagramId, source)
        if (runId !== this.#runId) return

        output.innerHTML = rendered.svg
        rendered.bindFunctions?.(output)
        return
      }

      const runtime = await loadDiagramRuntime()
      if (runId !== this.#runId) return

      const dot = runtime.dbmlRun(source, 'dot')
      if (!dot.trim()) {
        this.#renderError('DBML rendering produced an empty graph.')
        return
      }

      const output = document.createElement('div')
      output.className = 'markee-diagram-dbml'
      this.replaceChildren(output)

      await new Promise<void>((resolve, reject) => {
        try {
          const selection = runtime.select(output as HTMLElement) as any
          const graphviz = selection.graphviz({
            useWorker: true,
            fit: true,
            zoom: false,
          })

          this.#cleanup = () => {
            graphviz.destroy?.()
          }

          graphviz.onerror((message: string) => {
            reject(new Error(message))
          })

          graphviz.renderDot(dot, () => {
            resolve()
          })
        } catch (err) {
          reject(err)
        }
      })

      if (runId !== this.#runId) return
    } catch (err) {
      this.#renderError(
        `${kind.toUpperCase()} rendering failed.\n${toErrorMessage(err)}`,
      )
    }
  }

  #renderStatus(message: string) {
    this.innerHTML = `<div class="markee-diagram-status">${escapeHtml(message)}</div>`
  }

  #renderError(message: string) {
    this.#cleanup?.()
    this.#cleanup = null
    this.innerHTML = [
      '<div class="markee-diagram-error">',
      '<strong>Diagram error</strong>',
      `<pre>${escapeHtml(message)}</pre>`,
      '</div>',
    ].join('')
  }
}

export function registerDiagramElement() {
  window.customElements.define('markee-diagram', MarkeeDiagram)
}
