import { html } from 'lit'
import { MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'

const formatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
const formatDate = (date) => formatter.format(new Date(date))

class BlogInfo extends MarkeeElement.with({
  stores: [state.$currentFile],
}) {
  render() {
    const article = state.$currentFile.get()
    return html`
      <img alt="" src="${article.frontMatter.image}" />
      <span>${article.frontMatter.tags?.[0] ?? 'Article'}</span>
      <span>·</span>
      <span
        >${formatDate(article.frontMatter.date ?? article.revisionDate)}</span
      >
      <span>·</span>
      <span>${Math.round(article.readingTime)} min read</span>
    `
  }
}
BlogInfo.tag('blog-info')
