import * as AsciinemaPlayer from 'asciinema-player'
import { extend } from '@markee/runtime'

import 'asciinema-player/dist/bundle/asciinema-player.css'
import './index.css'

class Asciinema extends HTMLElement {
  connectedCallback() {
    AsciinemaPlayer.create(this.getAttribute('src'), this, { preload: true })
    this.querySelector<HTMLDivElement>('.ap-wrapper')!.style.maxWidth =
      this.getAttribute('width')!
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
