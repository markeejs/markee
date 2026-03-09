import { html, nothing } from 'lit'
import { state } from '@markee/runtime'
import { MarkeeElement } from '@markee/runtime'

const names = {
  jeremie: 'Jérémie van der Sande',
  ellie: 'Ellie H. Kellywick',
}
const titles = {
  jeremie: 'Fullstack Architect',
  ellie: 'Fullstack Developer',
}

class BlogAuthor extends MarkeeElement.with({
  stores: [state.$currentFile],
}) {
  static properties = {
    author: {
      type: String,
      default: 'jeremie',
    },
    variant: {
      type: String,
      attribute: 'variant',
    },
  }

  render() {
    const author =
      this.author ?? state.$currentFile.get().frontMatter?.authors?.[0]
    const name = names[author] ?? 'Jérémie van der Sande'
    const title = titles[author] ?? 'Fullstack Architect'

    return html`
      <img alt="" src="/blog/_images/${author}.jpeg" />
      <div>
        <span>${name}</span>
        ${this.variant === 'large' ? html`<span>${title}</span>` : nothing}
      </div>
    `
  }
}
BlogAuthor.tag('blog-author')
