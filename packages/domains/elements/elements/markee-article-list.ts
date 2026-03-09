import { nothing } from 'lit'
import { html, unsafeStatic } from 'lit/static-html.js'
import { customElement, property, state } from 'lit/decorators.js'
import { BooleanConverter, MarkeeElement } from '@markee/runtime'
import { state as store } from '@markee/runtime'
import { getPageLink, getPagination } from '../utils/pagination.js'

import './markee-article-list.css'

@customElement('markee-article-list')
export class MarkeeArticleList extends MarkeeElement.with({
  stores: [store.$navigation, store.$currentLoader],
}) {
  @property({ type: String, attribute: 'data-article-element' })
  articleElement: string = 'markee-article'

  @property({ type: String, attribute: 'data-empty-element' })
  emptyElement?: string

  @property({ type: String, attribute: 'data-order' })
  order?:
    | 'path'
    | 'title'
    | 'date'
    | '-path'
    | '-title'
    | '-date'
    | '+path'
    | '+title'
    | '+date'

  @property({ type: Number, attribute: 'data-limit' })
  limit?: number

  @property({ type: Number, attribute: 'data-page-size' })
  pageSize?: number

  @property({
    type: Boolean,
    converter: BooleanConverter,
    attribute: 'data-page-lead',
  })
  pageLead?: boolean

  @property({ type: String, attribute: 'data-filter-folder' })
  filterFolder?: string

  @property({ type: String, attribute: 'data-filter-tag' })
  filterTag?: string

  @property({ type: String, attribute: 'data-filter-author' })
  filterAuthor?: string

  @property({ type: String, attribute: 'data-filter-same' })
  filterSame?:
    | 'folder'
    | `root:${number}`
    | 'authors:first'
    | 'authors:any'
    | 'authors:all'
    | 'authors:exactly'
    | 'tags:first'
    | 'tags:any'
    | 'tags:all'
    | 'tags:exactly'

  @state()
  page: number = +(new URLSearchParams(window.location.search).get('page') ?? 1)

  static getOrder(
    order:
      | 'path'
      | 'title'
      | 'date'
      | '-path'
      | '-title'
      | '-date'
      | '+path'
      | '+title'
      | '+date' = 'date',
  ) {
    if (order?.startsWith('+') || order?.startsWith('-')) {
      return order.slice(1)
    }
    return order
  }

  static matchCandidate(filter: string, array?: string[]) {
    let method: 'some' | 'every' = 'some'
    let values = [filter.toLowerCase()]
    if (filter.startsWith('all:')) {
      filter = filter.slice('all:'.length)
      method = 'every'
      values = filter.toLowerCase().split(';')
    }
    if (filter.startsWith('any:')) {
      filter = filter.slice('any:'.length)
      values = filter.toLowerCase().split(';')
    }

    const candidate = array?.map((t) => t.toLowerCase()) ?? []
    return values[method]((t) => candidate.includes(t))
  }

  static filterRule(
    file: string | undefined,
    files: Record<string, MarkdownFile>,
    filterFolder?: string,
    filterTag?: string,
    filterAuthor?: string,
    filterSame?:
      | 'folder'
      | `root:${number}`
      | 'authors:first'
      | 'authors:any'
      | 'authors:all'
      | 'authors:exactly'
      | 'tags:first'
      | 'tags:any'
      | 'tags:all'
      | 'tags:exactly',
  ) {
    const fileData = file
      ? (files[file] as MarkdownFile)
      : ({ frontMatter: {} } as MarkdownFile)
    return (candidate: string) => {
      let valid = true
      const candidateData = files[candidate]

      if (filterFolder) {
        valid &&= candidate.startsWith(filterFolder)
      }
      if (filterTag) {
        valid &&= MarkeeArticleList.matchCandidate(
          filterTag,
          candidateData?.frontMatter?.tags,
        )
      }
      if (filterAuthor) {
        valid &&= MarkeeArticleList.matchCandidate(
          filterAuthor,
          candidateData?.frontMatter?.authors,
        )
      }

      if (filterSame && file) {
        const rules = filterSame.split(';')
        rules.forEach((rule) => {
          if (rule === 'folder') {
            const folder = file!.split('/').slice(0, -1).join('/')
            valid &&= candidate.startsWith(folder)
          }

          if (rule.startsWith('root:')) {
            const [, nb] = rule.split(':')
            const root = file.split('/').slice(0, +nb).join('/')
            valid &&= candidate.startsWith(root)
          }

          if (rule.startsWith('authors:') || rule.startsWith('tags:')) {
            const [kind, strategy] = rule.split(':')

            const origin = (
              fileData?.frontMatter?.[kind as 'authors' | 'tags'] ?? []
            ).map((c) => c.toLowerCase().trim())
            const candidates = (
              candidateData?.frontMatter?.[kind as 'authors' | 'tags'] ?? []
            ).map((c) => c.toLowerCase().trim())

            if (strategy === 'first') {
              valid &&= candidates.includes(origin[0])
            }
            if (strategy === 'any') {
              valid &&= origin.some((o) => candidates.includes(o))
            }
            if (strategy === 'all') {
              valid &&= origin.every((o) => candidates.includes(o))
            }
            if (strategy === 'exactly') {
              valid &&= origin.every((o) => candidates.includes(o))
              valid &&= candidates.every((o) => origin.includes(o))
            }
          }
        })
      }

      return valid
    }
  }

  connectedCallback() {
    super.connectedCallback()
    window.addEventListener('popstate', this.#popState)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('popstate', this.#popState)
  }

  #popState = () => {
    this.page = +(new URLSearchParams(window.location.search).get('page') ?? 1)
  }

  render() {
    const { key } = store.$currentLoader.get().data ?? {}
    const { files } = store.$navigation.get()

    const sortFunction = {
      path: (a: string, b: string) => {
        const aLink = files[a].link || ''
        const bLink = files[b].link || ''
        return aLink.localeCompare(bLink)
      },
      title: (a: string, b: string) => {
        const aTitle = files[a].frontMatter?.title || ''
        const bTitle = files[b].frontMatter?.title || ''
        return aTitle.localeCompare(bTitle, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      },
      date: (a: string, b: string) => {
        const aDate = new Date(
          files[a].frontMatter?.modificationDate ||
            files[a].frontMatter?.date ||
            0,
        ).valueOf()
        const bDate = new Date(
          files[b].frontMatter?.modificationDate ||
            files[b].frontMatter?.date ||
            0,
        ).valueOf()
        const aRevision = new Date(files[a].revisionDate || '').valueOf()
        const bRevision = new Date(files[b].revisionDate || '').valueOf()

        return bDate - aDate || bRevision - aRevision
      },
    }[MarkeeArticleList.getOrder(this.order)]

    const articles = Object.keys(files)
      .filter((a) => !this.filterSame || a !== key)
      .filter((article) => files[article].frontMatter?.hidden !== true)
      .filter(
        MarkeeArticleList.filterRule(
          key,
          files,
          this.filterFolder,
          this.filterTag,
          this.filterAuthor,
          this.filterSame,
        ),
      )
      .sort(sortFunction)

    if (this.order?.startsWith('-')) articles.reverse()

    const articleElement = unsafeStatic(this.articleElement)
    const emptyElement = this.emptyElement
      ? unsafeStatic(this.emptyElement)
      : null

    if (!articles.length) {
      return this.emptyElement
        ? html`<${emptyElement}></${emptyElement}>`
        : nothing
    }

    const shown = articles.slice(this.pageLead ? 1 : 0, this.limit)
    const pagination = getPagination({
      elements: shown,
      page: this.page,
      pageSize: this.pageSize ?? shown.length,
      onPageChange: (page) => {
        this.page = page
      },
    })

    return html`
      <ul>
        ${
          this.pageLead &&
          articles[0] &&
          html`
          <li data-lead="true">
            <${articleElement} data-article=${articles[0]}></${articleElement}>
          </li>
        `
        }
        ${pagination.slice.map(
          (article) => html`
          <li>
            <${articleElement} data-article=${article}></${articleElement}>
          </li>
        `,
        )}
      </ul>

      ${
        pagination.totalPages > 1
          ? html`
            <markee-article-list-pagination>
              <a
                @click=${pagination.openPreviousPage}
                href=${getPageLink(1, !pagination.openPreviousPage)}
              >
                <i class="fa fa-chevron-left"></i>
              </a>
              ${pagination.pageButtons.map((page) => {
                if (page) {
                  return html`<a
                    @click=${() => pagination.openPage(page)}
                    href=${getPageLink(page, page === this.page)}
                  >
                    ${page}
                  </a>`
                }
                return html`
                  <span><i class="fa fa-ellipsis"></i></span>
                `
              })}
              <a
                @click=${pagination.openNextPage}
                href=${getPageLink(
                  pagination.totalPages,
                  !pagination.openNextPage,
                )}
              >
                <i class="fa fa-chevron-right"></i>
              </a>
            </markee-article-list-pagination>
          `
          : nothing
      }
    `
  }
}
