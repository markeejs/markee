import { html } from 'lit'
import { MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'

export class SiblingArticle extends MarkeeElement.with({
  stores: [state.$navigation],
}) {
  render() {
    const { files } = state.$navigation.get()
    const article = files[this.article ?? '']
    const title = article?.frontMatter?.title || ''
    const link = article?.link || ''
  }
}
SiblingArticle.tag('sibling-article')
