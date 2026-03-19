import { customElement, property, state } from 'lit/decorators.js'
import { html, nothing } from 'lit'

import { state as store } from '@markee/runtime'
import { extend, MarkeeElement } from '@markee/runtime'

import { safelyRun } from '../utils/extensions.js'
import { highlight } from '../utils/highlight.js'

import './markee-search.css'

const TAG_REGEX = /\btag:(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g

const plural = (n: number) => (n === 1 ? '' : 's')

function parseSearchValue(input: string) {
  const tags = (input.match(TAG_REGEX) ?? [])
    .map((tag) => tag.slice(4).trim())
    .map((tag) =>
      (tag.at(0) === '"' && tag.at(-1) === '"') ||
      (tag.at(0) === "'" && tag.at(-1) === "'")
        ? tag.slice(1, -1)
        : tag,
    )
    .filter((tag) => tag.length)
  const value = input.replace(TAG_REGEX, '').trim()

  return {
    value: value.length ? value : tags.join(' '),
    tags,
    highlight: (value + ' ' + tags.join(' ')).trim(),
  }
}

function searchWithShards(
  search: ReturnType<typeof store.$search.get>,
  value: string,
  tags: string[],
) {
  const shards = safelyRun(() => extend.search.getShardingKeys?.(), [])
  if (!shards?.length) return search(value)

  return shards.flatMap((shard) =>
    search(value, {
      filters: [
        search.anyOf?.(
          'key',
          [MarkeeSearch.getShardValue(shard)],
          MarkeeSearch.getShardStrategy(shard),
        ),
        tags.length ? search.allOf?.('tags', tags, 'equals') : undefined,
      ].filter((filter) => !!filter),
    }),
  )
}

function groupSearchResults(results: SearchResult[]) {
  const grouped = safelyRun(
    () => extend.search.groupResults?.(results) ?? results,
    results,
  )

  return grouped[0] && 'sectionName' in grouped[0]
    ? (grouped as { sectionName: string; results: SearchResult[] }[])
    : [{ sectionName: '', results: grouped }]
}

@customElement('markee-search-file')
export class MarkeeSearchFile extends MarkeeElement.with({
  stores: [store.$navigation],
}) {
  @property({ type: String })
  file = ''

  @property({ type: String })
  search = ''

  @property({ type: Object })
  results: SearchResult['results'] = []

  @state()
  expanded = false

  #handleResultClick = () => {
    this.dispatchEvent(
      new CustomEvent('search-result-selected', {
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    const { file, results } = this
    const { tree, files } = store.$navigation.get()
    const ancestors = tree.getAncestorsForKey(file)
    const currentFile = ancestors.at(-1)
    const [primaryResult, ...more] = results
    const frontMatter = files[file]?.frontMatter
    const fileLink = currentFile?.link ?? ''

    if (!currentFile || !primaryResult) {
      return nothing
    }

    return html`
      <strong>${currentFile.label}</strong>
      <div>
        ${ancestors.slice(1, -1).map(
          (a, i) => html`
            ${
              i
                ? html`
                    <span data-separator>/</span>
                  `
                : nothing
            }
            <span>${a.label}</span>
          `,
        )}
      </div>

      ${
        frontMatter?.tags?.length
          ? html`
            <div>
              ${frontMatter.tags.map(
                (tag) => html`<span data-markable .content="${tag}"> ></span>`,
              )}
            </div>
          `
          : nothing
      }

      <a
        data-result
        @click=${this.#handleResultClick}
        href="${fileLink + primaryResult.anchor}"
      >
        <strong data-markable .content="${primaryResult.label}"> </strong>
        <div data-markable .content="${primaryResult.content}"></div>
      </a>

      ${
        more.length === 0
          ? nothing
          : html`
            <button @click=${() => (this.expanded = !this.expanded)}>
              ${this.expanded ? 'Hide' : 'Show'} ${more.length} more
              result${more.length > 1 ? 's' : ''}
            </button>
          `
      }

      <markee-collapse ?hidden=${!this.expanded}>
        ${more.map(
          (result) =>
            html`<a
              data-result
              @click=${this.#handleResultClick}
              href="${fileLink + result.anchor}"
            >
              <strong data-markable .content="${result.label}"> </strong>
              <div data-markable .content="${result.content}"></div>
            </a>`,
        )}
      </markee-collapse>
    `
  }

  updated() {
    highlight(this, this.search)
  }
}

@customElement('markee-search-section')
export class MarkeeSearchSection extends MarkeeElement {
  @property({ type: String })
  sectionName = ''

  @property({ type: String })
  search = ''

  @property({ type: Object })
  results: SearchResult[] = []

  render() {
    const label = this.sectionName
      ? `${this.results.length} matching document${plural(this.results.length)} in ${this.sectionName}`
      : `${this.results.length} matching document${plural(this.results.length)}`

    return html`
      <strong>${label}</strong>
      <article>
        ${this.results.map((result) => {
          const { results, file } = result

          return html`
            <markee-search-file
              .file=${file}
              .search=${this.search}
              .results=${results}
            ></markee-search-file>
          `
        })}
      </article>
    `
  }
}

@customElement('markee-search')
export class MarkeeSearch extends MarkeeElement.with({
  stores: [store.$search],
}) {
  static getShardValue(shard: string) {
    if (shard.startsWith('^')) shard = shard.slice(1)
    if (shard.endsWith('$')) shard = shard.slice(0, -1)
    return shard
  }

  static getShardStrategy(shard: string) {
    const startsWith = shard.startsWith('^')
    const endsWith = shard.endsWith('$')
    if (startsWith && endsWith) return 'equals'
    if (startsWith) return 'startsWith'
    if (endsWith) return 'endsWith'
    return 'includes'
  }

  @property({ type: String, attribute: 'data-results-page' })
  resultsPage?: string

  @property({ type: String, attribute: 'data-icon' })
  icon = 'fa fa-search'

  @property({ type: String, attribute: 'data-placeholder' })
  placeholder = ''

  @state() value = ''

  #debounce = 0

  #commitInputValue(value: string) {
    this.value = value
    window.setTimeout(() => {
      this.querySelector('[data-results]')?.scrollTo({ top: 0 })
    }, 10)
  }

  #clear = () => {
    this.value = ''
  }

  #handleInput = (e: Event) => {
    clearTimeout(this.#debounce)
    this.#debounce = window.setTimeout(() => {
      this.#commitInputValue((e.target as HTMLInputElement).value)
    }, 200)
  }

  #handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && this.resultsPage) {
      store.$router
        .get()
        .navigate.open(
          this.resultsPage +
            '?q=' +
            encodeURIComponent((e.currentTarget as HTMLInputElement).value),
        )
    }

    if (e.key === 'Escape') {
      this.#clear()
      this.querySelector('input')?.blur()
    }
  }

  #handleBackdropClick = () => {
    this.#clear()
  }

  #handleResultSelected = () => {
    this.#clear()
  }

  render() {
    const search = store.$search.get()

    const { value, tags, highlight } = parseSearchValue(this.value)
    const results = searchWithShards(search, value, tags)
    const groups = groupSearchResults(results)
    const hasResults = groups.some((group) => group.results.length > 0)

    return html`
      <div
        data-backdrop
        ?data-active=${hasResults}
        @click=${this.#handleBackdropClick}
      ></div>
      <input
        ?data-active=${hasResults}
        .value="${this.value}"
        placeholder=${this.placeholder}
        @input=${this.#handleInput}
        @keydown=${this.#handleKeyDown}
      />
      <div data-icon ?data-active=${hasResults} class=${this.icon}></div>
      <div
        data-results
        ?data-active=${hasResults}
        @search-result-selected=${this.#handleResultSelected}
      >
        ${groups
          .filter(({ results }) => results.length)
          .map(
            (group) => html`
              <markee-search-section
                .sectionName=${group.sectionName}
                .results=${group.results}
                .search=${highlight}
              >
              </markee-search-section>
            `,
          )}
      </div>
    `
  }
}
