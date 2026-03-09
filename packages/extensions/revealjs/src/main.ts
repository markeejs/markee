import RevealJS from 'reveal.js'
import 'reveal.js/dist/reveal.css'
import 'reveal.js/dist/theme/simple.css'
import './index.css'

class Reveal extends HTMLElement {
  connectedCallback() {
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
