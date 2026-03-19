import { afterEach } from 'vitest'

const define = customElements.define.bind(customElements)
customElements.define = ((name, constructor, options) => {
  if (customElements.get(name)) return
  define(name, constructor, options)
}) as typeof customElements.define

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value() {},
  })
}

window.matchMedia = () => ({ matches: false }) as MediaQueryList

afterEach(() => {
  document.body.innerHTML = ''
})

;(globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings =
  new Set([
    'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.',
  ])
