import type { TreeItem } from '@markee/state'
import { html, nothing } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { customElement, property, state } from 'lit/decorators.js'

import { MarkeeElement } from '@markee/runtime'
import { state as store } from '@markee/runtime'

import { getHeaders, type TocItem } from '../utils/table-of-contents.js'

import './markee-mobile-navigation.css'

@customElement('markee-mobile-navigation-toc')
export class MarkeeMobileNavigationToc extends MarkeeElement {
  @property({ type: Object })
  header: TocItem = {} as TocItem

  render() {
    return html`
      <a href="#${this.header.id}"> ${this.header.label} </a>
      ${
        this.header.items?.length
          ? html`<ul>
            ${this.header.items.map(
              (header) =>
                html`<li>
                  <markee-mobile-navigation-toc
                    .header=${header}
                  ></markee-mobile-navigation-toc>
                </li>`,
            )}
          </ul>`
          : nothing
      }
    `
  }
}

@customElement('markee-mobile-navigation-item')
export class MarkeeMobileNavigationItem extends MarkeeElement {
  @property({ type: Object })
  item: TreeItem = {} as TreeItem

  #handleExpandClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    this.dispatchEvent(
      new CustomEvent('open-children', {
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    return html`
      <a href=${this.item.link ? this.item.link : nothing}>
        ${this.item.label}
      </a>

      ${
        'items' in this.item && (this.item.items?.length ?? 0) > 0
          ? html`
              <button @click=${this.#handleExpandClick}>
                <i class="mdi mdi-chevron-right"></i>
              </button>
            `
          : nothing
      }
    `
  }
}

@customElement('markee-mobile-navigation')
export class MarkeeMobileNavigation extends MarkeeElement.with({
  stores: [store.$navigation, store.$currentLoader],
}) {
  @property({ type: Number, attribute: 'data-root-segments' })
  rootSegments: number = 0

  @property({ type: String, attribute: 'data-position' })
  position: 'left' | 'right' = 'left'

  @property({ type: Number, attribute: 'data-toc-depth' })
  tocDepth?: 3 | 4 | 5 | 6

  @state()
  opened = false

  @state()
  shownPath = '/'

  #lastKnownKey = ''
  #lastOpened = false

  #syncState() {
    const fileKey = store.$currentLoader.get()?.data?.key
    const path = fileKey ?? '/'

    if (fileKey && fileKey !== this.#lastKnownKey) {
      this.#lastKnownKey = fileKey
      this.shownPath = path
      this.opened = false
    }

    if (this.opened !== this.#lastOpened) {
      this.#lastOpened = this.opened
      this.shownPath = path
    }
  }

  #getNavigationState() {
    const { tree } = store.$navigation.get()
    const file = store.$currentLoader.get()?.data
    const fileKey = file?.key
    const path = fileKey ?? '/'
    const headers = getHeaders(false, this.tocDepth)
    const ancestors = tree.getAncestorsForKey(this.shownPath)
    const root = ancestors.at(
      Math.max(0, this.rootSegments - 1),
    ) as TreeItem | null
    const current = ancestors.at(-1)
    const backPath =
      this.shownPath === root?.key ? root?.key : current?.parent?.key
    const parentTree = backPath ? tree.getBranchByKey(backPath) : null

    const showTableOfContents =
      !!fileKey &&
      ((headers.length > 0 && current?.key === fileKey) ||
        ((current as TreeItem)?.indexKey === fileKey &&
          !(current as TreeItem)?.items?.length))
    const showParentTree = !headers.length && this.shownPath === fileKey
    const shownTree = showParentTree ? parentTree : current
    const self =
      shownTree && 'items' in shownTree
        ? shownTree.items?.find((i) => i.key === fileKey)
        : shownTree

    return {
      fileKey,
      path,
      headers,
      root,
      current,
      backPath,
      shownTree,
      self,
      showTableOfContents,
    }
  }

  #handleNavigateBack = () => {
    const { backPath } = this.#getNavigationState()
    if (backPath) {
      this.shownPath = backPath
    }
  }

  #handleClose = () => {
    this.opened = false
  }

  #handleDrawerChange = (e: Event) => {
    this.opened = (e.currentTarget as any).open
  }

  #handleTocClick = () => {
    this.opened = false
  }

  #handleItemOpen = (e: Event, key: string) => {
    e.stopPropagation()
    this.shownPath = key
  }

  willUpdate() {
    this.#syncState()
  }

  render() {
    const { fileKey, headers, root, shownTree, self, showTableOfContents } =
      this.#getNavigationState()

    const backArrowFragment =
      this.shownPath !== root?.key
        ? html`
            <button @click=${this.#handleNavigateBack}>
              <i class="mdi mdi-chevron-left"></i>
            </button>
          `
        : nothing

    const closeArrowFragment = html`
      <button @click=${this.#handleClose}>
        <i class="mdi mdi-close"></i>
      </button>
    `

    const tableOfContentsFragment = html`
      <header>
        ${backArrowFragment}
        <span>${self?.label}</span>
        ${closeArrowFragment}
      </header>
      <nav>
        <ul>
          ${headers.map(
            (header) =>
              html`<li>
                <markee-mobile-navigation-toc
                  @click=${this.#handleTocClick}
                  .header=${header}
                />
              </li>`,
          )}
        </ul>
      </nav>
    `
    const navigationFragment = html`
      <header>
        ${backArrowFragment}
        <span>${shownTree?.label}</span>
        ${closeArrowFragment}
      </header>
      <nav>
        <ul>
          ${repeat(
            (shownTree as TreeItem)?.items?.filter((item) => !item.hidden) ??
              [],
            (item) => item.key,
            (item) => html`<li data-selected=${fileKey === item.key}>
              <markee-mobile-navigation-item
                @open-children=${(e: Event) => this.#handleItemOpen(e, item.key)}
                .item=${item}
              >
            </li>`,
          )}
        </ul>
      </nav>
    `

    return html`
      <markee-drawer
        .open=${this.opened}
        .side=${this.position}
        @change=${this.#handleDrawerChange}
      >
        <i slot="button" class="fa fa-bars"></i>
        ${showTableOfContents ? tableOfContentsFragment : nothing}
        ${!showTableOfContents && shownTree ? navigationFragment : nothing}
      </markee-drawer>
    `
  }
}
