import { customElement, property } from 'lit/decorators.js'
import { MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'
import { html } from 'lit'

@customElement('markee-article')
export class MarkeeArticle extends MarkeeElement.with({
  role: 'article',
  stores: [state.$navigation],
}) {
  @property({ type: String, attribute: 'data-article' })
  article: string = ''

  render() {
    const { files } = state.$navigation.get()
    const article = files[this.article ?? '']
    const title = article?.frontMatter?.title || ''

    return html`<a href=${article?.link}>${title}</a>`
  }
}
