import { html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { state as store } from '@markee/runtime'
import { BooleanConverter, MarkeeElement } from '@markee/runtime'

import { containsItem, filterItem, isItem } from '../utils/navigation.js'
import { scrollToRef } from '../utils/scrollarea.js'

import './markee-side-navigation.css'
import { highlight } from '../utils/highlight.js'

function makeNavigationLabel(options: {
  item: TreeLeaf | TreeItem
  selected: boolean
  collapsible: boolean
  expanded: boolean
  onExpandedChange?: (expanded: boolean) => void
}) {
  const content = html`
    <span data-markable .content="${options.item.label}"></span>
    ${
      options.collapsible && (options.item as TreeItem).items?.length
        ? html`
            <i class="mdi mdi-chevron-right"></i>
          `
        : nothing
    }
    ${
      options.item.outdated
        ? html`
          <div data-outdated id="${options.item.key + '-outdated'}"></div>
          <markee-hovercard
            for="${options.item.key + '-outdated'}"
            placement="bottom"
          >
            You're seeing an older version of this content.
            <a href="${options.item.outdated}">Load the latest version</a>.
          </markee-hovercard>
        `
        : nothing
    }
  `

  const handleClick = (e: MouseEvent) => {
    if (!options.collapsible) return

    if ((e.target as HTMLElement).tagName === 'I') {
      e.preventDefault()
      options.onExpandedChange?.(!options.expanded)
    } else {
      options.onExpandedChange?.(true)
    }
  }

  if (options.item.link) {
    return html`
      <a
        @click=${handleClick}
        href="${options.item.link}"
        data-expandable=${options.collapsible}
        data-expanded=${options.expanded}
        data-selected=${options.selected}
      >
        ${content}
      </a>
    `
  }

  return html`
    <span
      @click=${handleClick}
      data-expandable=${options.collapsible}
      data-expanded=${options.expanded}
      data-selected=${options.selected}
    >
      ${content}
    </span>
  `
}

function makeNavigationSubTree(options: {
  item: TreeLeaf | TreeItem
  collapsed?: boolean
  path: string
  defaults: {
    collapsible: boolean
    expanded: boolean
  }
}) {
  if (
    !('items' in options.item) ||
    !options.item.items?.length ||
    options.item.hidden
  ) {
    return nothing
  }

  return html`
    <markee-collapse ?hidden=${options.collapsed}>
      <ul>
        ${options.item.items.map(
          (item) => html`
            <markee-navigation-item
              .item=${item}
              .defaults=${options.defaults}
              .path="${options.path}"
              .selected=${containsItem(item, options.path)}
              .current=${isItem(item, options.path)}
            ></markee-navigation-item>
          `,
        )}
      </ul>
    </markee-collapse>
  `
}

@customElement('markee-navigation-item')
export class MarkeeNavigationItem extends MarkeeElement {
  @property({ type: Object, reflect: false })
  item = {} as TreeLeaf | TreeItem

  @property({ type: Object, reflect: false })
  defaults = {
    collapsible: false,
    expanded: false,
  }

  @property({ type: Boolean, converter: BooleanConverter, reflect: true })
  selected = false

  @property({ type: Boolean, converter: BooleanConverter, reflect: true })
  current = false

  @property({ type: String })
  path = ''

  @state()
  expanded = false

  #expandedInitialized = false

  #getCollapsible() {
    return 'collapsible' in this.item
      ? !!this.item.collapsible
      : this.defaults.collapsible
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    const hasRelevantChanges = ['item', 'defaults', 'selected'].some(
      (property) => changedProperties.has(property),
    )

    if (this.#expandedInitialized || !hasRelevantChanges) {
      return
    }

    const collapsible = this.#getCollapsible()
    const initiallyExpanded = this.defaults.expanded ? true : !collapsible

    this.expanded = initiallyExpanded || this.selected
    this.#expandedInitialized = true
  }

  render() {
    const collapsible = this.#getCollapsible()

    if (this.item.hidden) return nothing

    return html`
      <li>
        ${makeNavigationLabel({
          item: this.item,
          selected: this.selected,
          expanded: this.expanded,
          collapsible,
          onExpandedChange: (expanded) => (this.expanded = expanded),
        })}
        ${makeNavigationSubTree({
          item: this.item,
          path: this.path,
          defaults: this.defaults,
          collapsed: collapsible && !this.expanded,
        })}
      </li>
    `
  }

  updated(changedProperties: Map<string, unknown>) {
    if (this.current && changedProperties.has('current')) {
      scrollToRef(this)
    }
  }
}

@customElement('markee-side-navigation')
export class MarkeeSideNavigation extends MarkeeElement.with({
  role: 'navigation',
  stores: [store.$navigation, store.$currentLoader],
}) {
  @property({ type: String, attribute: 'data-min-entry-width' })
  minEntryWidth?: string

  @property({ type: String, attribute: 'data-white-space' })
  whiteSpace?: string

  @property({
    type: Boolean,
    converter: BooleanConverter,
    attribute: 'data-filter',
  })
  showFilter = false

  @property({ type: String, attribute: 'data-filter-placeholder' })
  filterPlaceholder = ''

  @property({ type: String, attribute: 'data-filter-icon' })
  filterIcon = 'mdi mdi-filter-variant'

  @property({
    type: Boolean,
    converter: BooleanConverter,
    attribute: 'data-hide-root',
  })
  hideRoot = false

  @property({ type: Number, attribute: 'data-root-segments' })
  rootSegments?: number

  @property({ type: Number, attribute: 'data-min-root-segments' })
  minRootSegments?: number

  @property({
    type: Boolean,
    converter: BooleanConverter,
    attribute: 'data-default-expanded',
  })
  defaultExpanded?: boolean

  @property({
    type: Boolean,
    converter: BooleanConverter,
    attribute: 'data-default-collapsible',
  })
  defaultCollapsible?: boolean

  @state()
  filter = ''

  #syncStyles() {
    if (this.minEntryWidth) {
      this.style.setProperty('--private-min-entry-width', this.minEntryWidth)
    } else {
      this.style.removeProperty('--private-min-entry-width')
    }

    if (this.whiteSpace) {
      this.style.setProperty('--private-white-space', this.whiteSpace)
    } else {
      this.style.removeProperty('--private-white-space')
    }
  }

  #handleFilterInput = (e: InputEvent) => {
    this.filter = (e.currentTarget as HTMLInputElement).value
  }

  #getVisibleRoot() {
    const { tree } = store.$navigation.get()
    const { key } = store.$currentLoader.get().data ?? {
      key: '',
    }
    const ancestors = tree.getAncestorsForKey(key)
    let root = ancestors.at((this.rootSegments ?? 1) - 1)

    if (this.filter) {
      root = filterItem(root, this.filter)[0]
    }

    if (!root) {
      return { key, root: null, ancestors }
    }

    if (this.minRootSegments && ancestors.length < this.minRootSegments) {
      return { key, root: null, ancestors }
    }

    return { key, root, ancestors }
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has('minEntryWidth') ||
      changedProperties.has('whiteSpace')
    ) {
      this.#syncStyles()
    }
  }

  render() {
    const { key, root } = this.#getVisibleRoot()

    if (!root) {
      return nothing
    }

    return html`
      ${
        root.label && !this.hideRoot
          ? makeNavigationLabel({
              item: root,
              selected: key === root.key,
              collapsible: false,
              expanded: true,
            })
          : nothing
      }
      ${
        this.showFilter
          ? html`<input
              .value="${this.filter}"
              placeholder=${this.filterPlaceholder}
              @input=${this.#handleFilterInput}
            />
            <div data-icon class=${this.filterIcon}></div>`
          : nothing
      }
      <markee-scroll-area>
        ${makeNavigationSubTree({
          item: root,
          path: key,
          defaults: {
            expanded: this.defaultExpanded ?? false,
            collapsible: this.defaultCollapsible ?? true,
          },
        })}
      </markee-scroll-area>
    `
  }

  async updated() {
    const items = [
      ...this.querySelectorAll<MarkeeNavigationItem>('markee-navigation-item'),
    ]
    await Promise.all(items.map((item) => item.updateComplete))
    requestAnimationFrame(() => highlight(this, this.filter, false))
  }
}
