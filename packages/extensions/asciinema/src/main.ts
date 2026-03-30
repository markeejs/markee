import { extend } from '@markee/runtime'
import { loadAsciinemaStyles } from './styles.js'

let asciinemaStylesPromise: Promise<void> | undefined
let asciinemaPlayerPromise:
  | Promise<typeof import('asciinema-player')>
  | undefined

function ensureAsciinemaStyles() {
  asciinemaStylesPromise ??= loadAsciinemaStyles()

  return asciinemaStylesPromise
}

function loadAsciinemaPlayer() {
  asciinemaPlayerPromise ??= import('asciinema-player')

  return asciinemaPlayerPromise
}

class Asciinema extends HTMLElement {
  async connectedCallback() {
    const [AsciinemaPlayer] = await Promise.all([
      loadAsciinemaPlayer(),
      ensureAsciinemaStyles(),
    ])
    if (!this.isConnected) return

    AsciinemaPlayer.create(this.getAttribute('src'), this, { preload: true })
    const width = this.getAttribute('width')
    if (width) {
      this.querySelector<HTMLDivElement>('.ap-wrapper')?.style.setProperty(
        'max-width',
        width,
      )
    }
  }
}

customElements.define('asciinema-player', Asciinema)

extend.markdownPipeline.remark('asciinema', () => (tree) => {
  extend.markdownPipeline.visit(tree, 'image', (elem) => {
    if (elem.url?.endsWith('.cast')) {
      elem.type = 'element' as 'image'
      elem.data = {
        hName: 'asciinema-player',
        hProperties: {
          src: elem.url,
        },
      }
    }
  })
})
