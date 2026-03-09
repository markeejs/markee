import { html, unsafeStatic } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import { MarkeeElement } from '@markee/runtime'

import { $siblings } from '../utils/siblings.js'

abstract class MarkeeSibling extends MarkeeElement.with({
  stores: [$siblings],
}) {
  @property({ type: String, attribute: 'data-article-element' })
  articleElement: string = 'markee-article'

  abstract getArticle(): string

  render() {
    const article = this.getArticle()
    const element = unsafeStatic(this.articleElement)

    return html`<${element} data-article="${article}"></${element}> `
  }
}

@customElement('markee-next-article')
export class MarkeeNextArticle extends MarkeeSibling {
  getArticle() {
    return $siblings.get().next?.key ?? ''
  }
}

@customElement('markee-previous-article')
export class MarkeePreviousArticle extends MarkeeSibling {
  getArticle() {
    return $siblings.get().previous?.key ?? ''
  }
}
