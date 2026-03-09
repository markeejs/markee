import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import compare from 'string-comparison'

import { state } from '@markee/runtime'
import { MarkeeElement } from '@markee/runtime'

import './markee-document-suggestion.css'

@customElement('markee-document-suggestion')
export class MarkeeDocumentSuggestion extends MarkeeElement.with({
  stores: [state.$router, state.$navigation],
}) {
  @property({ type: Number, attribute: 'data-limit' })
  limit = 5

  render() {
    const { path } = state.$router.get()
    const { files, folders } = state.$navigation.get()

    const similar = Object.entries(files)
      .map(([key, info]: [string, any]) => ({
        key,
        title: info.frontMatter?.title ?? '',
        link: info.link,
        distance: compare.diceCoefficient.similarity(path ?? '/', info.link),
      }))
      .sort((a, b) => b.distance - a.distance)
      .slice(0, this.limit)
      .map((file) => ({
        ...file,
        parents: file.key
          .split('/')
          .map((_, i) => file.key.split('/').slice(0, i).join('/'))
          .filter((folder) => folder)
          .map((folder) => {
            const parent = Object.values(folders).find((p) =>
              p.navigation?.some((n) => n.key === folder),
            )
            const parentEntry = parent?.navigation?.find(
              (n) => n.key === folder,
            )

            return (
              folders[folder]?.title ||
              parentEntry?.title ||
              folders[folder]?.inferredTitle ||
              ''
            )
          }),
      }))

    return html`
      <ul>
        ${similar.map(
          (file) =>
            html` <li>
              <a href="${file.link}"><span>${file.title}</span></a>
              <div data-breadcrumbs>
                ${file.parents.map(
                  (parent, i) => html`
                    ${
                      i
                        ? html`
                            <span data-separator>/</span>
                          `
                        : nothing
                    }
                    <span>${parent}</span>
                  `,
                )}
              </div>
              <pre>${file.link}</pre>
            </li>`,
        )}
      </ul>
    `
  }
}
