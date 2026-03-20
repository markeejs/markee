import { loadRedefineCustomElements } from './load-redefine-custom-elements.js'

await loadRedefineCustomElements()

const _define = customElements.define.bind(customElements)
customElements.define = (name, constructor) => {
  _define(name, constructor)
  document.querySelectorAll(name).forEach((e) => {
    if (e instanceof constructor) return
    const clone = e.cloneNode(true) as HTMLElement
    e.replaceWith(clone)

    // We need to nuke the previous content of LitElements
    // to let lit correctly replace without duplication
    if ('requestUpdate' in clone) {
      clone.innerHTML = ''
    }
  })
}

const { loadHead } = await import('./listeners/hot-reload.js')
await loadHead()
await import('./main.js')
