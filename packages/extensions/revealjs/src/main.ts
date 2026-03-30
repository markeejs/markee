import { loadRevealStyles } from './styles.js'

let revealStylesPromise: Promise<void> | undefined
let revealModulePromise: Promise<any> | undefined

function ensureRevealStyles() {
  revealStylesPromise ??= loadRevealStyles()

  return revealStylesPromise
}

function loadRevealJs() {
  revealModulePromise ??= import('reveal.js').then((module) => module.default)

  return revealModulePromise
}

class Reveal extends HTMLElement {
  async connectedCallback() {
    const [RevealJS] = await Promise.all([loadRevealJs(), ensureRevealStyles()])
    if (!this.isConnected) return

    let config: Record<string, any> = {}
    try {
      config = JSON.parse(this.dataset.config || '{}')
    } catch (err) {
      void err
    }

    this.classList.toggle('reveal', true)
    this.classList.toggle('no-layout', this.dataset.layout === 'raw')
    const slides = document.createElement('div')
    slides.classList.toggle('slides', true)

    slides.innerHTML = this.innerHTML.replaceAll('reveal-slide', 'section')
    this.replaceChildren(slides)

    new RevealJS(this, {
      embedded: true,
      disableLayout: this.dataset.layout === 'raw',
      keyboardCondition: 'focused',
      width: this.getBoundingClientRect().width,
      height: this.getBoundingClientRect().height,
      ...config,
    }).initialize()
  }
}

customElements.define('reveal-js', Reveal)
