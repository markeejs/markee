import { createFilterLayoutPlugin, type ActiveFilter } from './base-layout'
import {
  decodeRecord,
  decodeText,
  escapeHtml,
  parseOpenApiSource,
  toErrorMessage,
} from './helpers'
import {
  resolveActiveFilter,
  validateFilter,
  type SwaggerUiFilters,
} from './filters'

let swaggerUiBundlePromise: Promise<any> | null = null

function loadSwaggerUiBundle() {
  if (!swaggerUiBundlePromise) {
    swaggerUiBundlePromise =
      import('swagger-ui-dist/swagger-ui-bundle.js').then(
        (module: any) => module.default ?? module,
      )
  }
  return swaggerUiBundlePromise
}

class MarkeeSwaggerUi extends HTMLElement {
  #runId = 0
  #uiInstance: any = null

  static get observedAttributes() {
    return ['src', 'tag', 'operation', 'schema', 'data-source', 'data-filters']
  }

  connectedCallback() {
    this.#renderStatus('Loading Swagger UI...')
    void this.#render()
  }

  attributeChangedCallback(
    _name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    if (oldValue === newValue) return
    if (!this.isConnected) return
    this.#renderStatus('Loading Swagger UI...')
    void this.#render()
  }

  disconnectedCallback() {
    this.#runId++
    this.#destroyUi()
  }

  #destroyUi() {
    if (this.#uiInstance && typeof this.#uiInstance.destroy === 'function') {
      this.#uiInstance.destroy()
    }
    this.#uiInstance = null
  }

  async #resolveSource() {
    const encodedSource = this.dataset.source
    if (encodedSource) {
      try {
        return decodeText(encodedSource)
      } catch {
        throw new Error('Could not decode inline OpenAPI source.')
      }
    }

    const src = this.getAttribute('src')?.trim() ?? ''
    if (!src) {
      throw new Error(
        'Missing OpenAPI source. Provide fenced content or a src attribute.',
      )
    }

    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(
        `Could not load OpenAPI source from "${src}" (${response.status} ${response.statusText}).`,
      )
    }

    return await response.text()
  }

  #resolveFilters(): SwaggerUiFilters {
    const fromDataset = decodeRecord(this.dataset.filters) as SwaggerUiFilters

    const filters: SwaggerUiFilters = {
      tag: String(fromDataset.tag ?? ''),
      operation: String(fromDataset.operation ?? ''),
      schema: String(fromDataset.schema ?? ''),
    }

    if (this.hasAttribute('tag')) {
      filters.tag = this.getAttribute('tag') ?? ''
    }
    if (this.hasAttribute('operation')) {
      filters.operation = this.getAttribute('operation') ?? ''
    }
    if (this.hasAttribute('schema')) {
      filters.schema = this.getAttribute('schema') ?? ''
    }

    return filters
  }

  async #render() {
    const runId = ++this.#runId

    try {
      const source = await this.#resolveSource()
      if (runId !== this.#runId) return

      const SwaggerUIBundle = await loadSwaggerUiBundle()
      if (runId !== this.#runId) return

      this.#destroyUi()

      const parsedSpec = parseOpenApiSource(source)
      const activeFilter: ActiveFilter | null = validateFilter(
        parsedSpec,
        resolveActiveFilter(this.#resolveFilters()),
      )

      const container = document.createElement('div')
      container.className = 'markee-swaggerui__container'
      this.replaceChildren(container)

      const config: Record<string, any> = {
        domNode: container,
        spec: parsedSpec,
        deepLinking: false,
        docExpansion: 'list',
        displayRequestDuration: true,
      }

      if (activeFilter) {
        config.plugins = [createFilterLayoutPlugin(activeFilter)]
      }

      if (activeFilter?.type === 'schema') {
        config.docExpansion = 'none'
        if (config.defaultModelsExpandDepth === undefined) {
          config.defaultModelsExpandDepth = 1
        }
      }

      this.#uiInstance = SwaggerUIBundle(config)
    } catch (err) {
      this.#renderError(`Swagger UI rendering failed.\n${toErrorMessage(err)}`)
    }
  }

  #renderStatus(message: string) {
    const status = document.createElement('div')
    status.className = 'markee-swaggerui-status'
    status.textContent = message
    this.replaceChildren(status)
  }

  #renderError(message: string) {
    this.#destroyUi()

    const wrapper = document.createElement('div')
    wrapper.className = 'markee-swaggerui-error'

    const heading = document.createElement('strong')
    heading.textContent = 'Swagger UI error'

    const pre = document.createElement('pre')
    pre.innerHTML = escapeHtml(message)

    wrapper.append(heading, pre)
    this.replaceChildren(wrapper)
  }
}

export function registerSwaggerUiElement() {
  window.customElements.define('markee-swaggerui', MarkeeSwaggerUi)
}
