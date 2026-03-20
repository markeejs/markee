import { afterEach, vi } from 'vitest'

function createMediaQueryList() {
  return {
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  }
}

export function installMarkeeVitestSetup(options = {}) {
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value() {},
    })
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => createMediaQueryList(),
  })

  if (options.protectCustomElements) {
    const registry = customElements
    if (!registry.__markeeVitestProtected) {
      const define = registry.define.bind(registry)
      registry.define = (name, constructor, config) => {
        if (registry.get(name)) return
        define(name, constructor, config)
      }
      registry.__markeeVitestProtected = true
    }
  }

  afterEach(() => {
    if (options.restoreMocks) {
      vi.restoreAllMocks()
    }

    document.body.innerHTML = ''

    if (options.clearBodyLoading) {
      document.body.dataset.loading = ''
    }

    if (options.clearStorage) {
      localStorage.clear()
      sessionStorage.clear()
    }
  })

  if (options.muteLitDevWarnings) {
    globalThis.litIssuedWarnings = new Set([
      'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.',
    ])
  }
}
