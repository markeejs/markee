import { html } from 'lit'
import { MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'

class BlogArticleCard extends MarkeeElement.with({
  role: 'article',
  stores: [state.$navigation],
}) {
  static properties = {
    article: { type: String, attribute: 'data-article' },
  }

  render() {
    const articleId = this.article
    const article = state.$navigation.get().files[articleId]

    return html`
      <a href=${article.link}>
        <img alt="" src=${article.frontMatter.image} />
        <div>
          <span>${article.frontMatter.tags?.[0] ?? 'Article'}</span>
          <span>·</span>
          <span>${Math.round(article.readingTime)} min read</span>
        </div>
        <h3>${article.frontMatter.title}</h3>
        <p>${article.frontMatter.excerpt}</p>
        <blog-author
          .author="${article.frontMatter.authors?.[0]}"
        ></blog-author>
      </a>
    `
  }
}
BlogArticleCard.tag('blog-article-card')
