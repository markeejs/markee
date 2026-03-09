import { customElement, property, state } from 'lit/decorators.js'
import { html, nothing } from 'lit'

import { state as store } from '@markee/runtime'
import { extend, MarkeeElement } from '@markee/runtime'

import { safelyRun } from '../utils/extensions.js'
import { highlight } from '../utils/highlight.js'

import './markee-search.css'

const TAG_REGEX = /\btag:(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g

const plural = (n: number) => (n === 1 ? '' : 's')

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

  render() {
    const { file, results } = this
    const { tree, files } = store.$navigation.get()
    const ancestors = tree.getAncestorsForKey(file)
    const more = results.slice(1)
    const frontMatter = files[file]?.frontMatter

    return html`
      <strong>${ancestors.at(-1)?.label}</strong>
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
        @click=${() =>
          ((this.closest('markee-search') as HTMLInputElement).value = '')}
        href="${ancestors.at(-1)?.link + results[0].anchor}"
      >
        <strong data-markable .content="${results[0].label}"> </strong>
        <div data-markable .content="${results[0].content}"></div>
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
              href="${ancestors.at(-1)?.link + result.anchor}"
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
    return html`
      <strong
        >${this.results.length} matching document${plural(this.results.length)}
        in ${this.sectionName}</strong
      >
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

  #handleInput = (e: Event) => {
    clearTimeout(this.#debounce)
    this.#debounce = window.setTimeout(() => {
      this.value = (e.target as HTMLInputElement).value
      setTimeout(() => {
        this.querySelector('[data-results]')?.scrollTo({ top: 0 })
      }, 10)
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
      this.value = ''
      this.querySelector('input')?.blur()
    }
  }

  #handleBackdropClick = () => {
    this.value = ''
  }

  #treatValue() {
    const tags = (this.value.match(TAG_REGEX) ?? [])
      .map((tag) => tag.slice(4).trim())
      .map((tag) =>
        (tag.at(0) === '"' && tag.at(-1) === '"') ||
        (tag.at(0) === "'" && tag.at(-1) === "'")
          ? tag.slice(1, -1)
          : tag,
      )
      .filter((tag) => tag.length)
    const value = this.value.replace(TAG_REGEX, '').trim()
    return {
      value: value.length ? value : tags.join(' '),
      tags: tags,
      highlight: value + ' ' + tags.join(' '),
    }
  }

  render() {
    const search = store.$search.get()

    const { value, tags, highlight } = this.#treatValue()

    const shards = safelyRun(() => extend.search.getShardingKeys?.(), [])
    const results = shards?.length
      ? shards.flatMap((shard) =>
          search(value, {
            filters: [
              search.anyOf?.(
                'key',
                [MarkeeSearch.getShardValue(shard)],
                MarkeeSearch.getShardStrategy(shard),
              ),
              tags.length ? search.allOf?.('tags', tags, 'equals') : undefined,
            ].filter((t) => !!t),
          }),
        )
      : search(value)

    const _groups = safelyRun(
      () => extend.search.groupResults?.(results) ?? results,
      results,
    )
    const groups =
      _groups[0] && 'sectionName' in _groups[0]
        ? (_groups as { sectionName: string; results: SearchResult[] }[])
        : [{ sectionName: '', results: _groups }]

    if (groups.some((g) => g.results.length > 0)) {
      this.dataset.active = ''
    } else {
      delete this.dataset.active
    }

    return html`
      <div data-backdrop @click=${this.#handleBackdropClick}></div>
      <input
        .value="${this.value}"
        placeholder=${this.placeholder}
        @input=${this.#handleInput}
        @keydown=${this.#handleKeyDown}
      />
      <div data-icon class=${this.icon}></div>
      <div data-results>
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
