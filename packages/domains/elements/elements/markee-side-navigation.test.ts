import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import * as highlightUtils from '../utils/highlight'
import * as scrollareaUtils from '../utils/scrollarea'
import {
  MarkeeNavigationItem,
  MarkeeSideNavigation,
} from './markee-side-navigation'

const runtimeState = {
  navigation: {
    tree: {
      getAncestorsForKey: () => [] as any[],
    } as any,
  },
  currentLoader: {
    data: null,
    error: null,
    loading: false,
  } as ReturnType<typeof state.$currentLoader.get>,
}

function createNavigationFixtures() {
  const start = {
    key: 'docs/guide/start.md',
    label: 'Start',
    link: '/docs/guide/start',
    hidden: false,
  }
  const advanced = {
    key: 'docs/guide/advanced.md',
    label: 'Advanced',
    link: '/docs/guide/advanced',
    hidden: false,
    outdated: '/latest/advanced',
  }
  const guide = {
    key: 'docs/guide',
    label: 'Guide',
    link: '/docs/guide',
    hidden: false,
    collapsible: true,
    items: [start, advanced],
  }
  const intro = {
    key: 'docs/intro.md',
    label: 'Intro',
    link: '/docs/intro',
    hidden: false,
  }
  const docs = {
    key: 'docs',
    label: 'Docs',
    link: '/docs',
    hidden: false,
    items: [intro, guide],
  }
  const root = {
    key: 'root',
    label: 'Root',
    link: '/root',
    hidden: false,
    items: [docs],
  }

  const ancestorMap: Record<string, any[]> = {
    [root.key]: [root],
    [docs.key]: [root, docs],
    [intro.key]: [root, docs, intro],
    [guide.key]: [root, docs, guide],
    [start.key]: [root, docs, guide, start],
    [advanced.key]: [root, docs, guide, advanced],
  }

  runtimeState.navigation = {
    tree: {
      getAncestorsForKey: (key: string) => ancestorMap[key] ?? [],
    } as any,
  }

  return { root, docs, intro, guide, start, advanced }
}

beforeEach(() => {
  vi.restoreAllMocks()
  runtimeState.navigation = {
    tree: {
      getAncestorsForKey: () => [],
    } as any,
  }
  runtimeState.currentLoader = {
    data: null,
    error: null,
    loading: false,
  }

  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => runtimeState.navigation as any,
  )
  vi.spyOn(state.$navigation, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$currentLoader, 'get').mockImplementation(
    () => runtimeState.currentLoader,
  )
  vi.spyOn(state.$currentLoader, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(highlightUtils, 'highlight').mockImplementation(() => {})
  vi.spyOn(scrollareaUtils, 'scrollToRef').mockImplementation(() => {})
  vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }) as typeof requestAnimationFrame)
})

describe('MarkeeNavigationItem', () => {
  it('renders a linked collapsible item with outdated marker, initializes collapsed state, and toggles expansion from clicks', async () => {
    const { guide } = createNavigationFixtures()

    const element = new MarkeeNavigationItem()
    element.item = guide as any
    element.defaults = { collapsible: false, expanded: false }
    element.path = 'docs/guide/start.md'
    document.body.append(element)

    await element.updateComplete

    const link = element.querySelector('a') as HTMLAnchorElement
    const icon = element.querySelector('i') as HTMLElement
    const collapse = element.querySelector('markee-collapse')

    expect(element.expanded).toBe(false)
    expect(link.getAttribute('href')).toBe('/docs/guide')
    expect(link.dataset.expandable).toBe('true')
    expect(link.dataset.expanded).toBe('false')
    expect(element.querySelector('[data-outdated]')).not.toBeNull()
    expect(element.querySelector('markee-hovercard a')?.getAttribute('href')).toBe(
      '/latest/advanced',
    )
    expect(collapse?.hasAttribute('hidden')).toBe(true)
    expect(element.querySelectorAll('markee-navigation-item')).toHaveLength(2)

    icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await element.updateComplete

    expect(element.expanded).toBe(true)
    expect(link.dataset.expanded).toBe('true')

    link.addEventListener('click', (event) => event.preventDefault())
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await element.updateComplete

    expect(element.expanded).toBe(true)
  })

  it('renders a selected non-linked item expanded and ignores clicks when it is not collapsible', async () => {
    const item = {
      key: 'docs/group',
      label: 'Group',
      hidden: false,
      items: [{ key: 'docs/group/page.md', label: 'Page', link: '/page', hidden: false }],
    }

    const element = new MarkeeNavigationItem()
    element.item = item as any
    element.defaults = { collapsible: false, expanded: false }
    element.selected = true
    document.body.append(element)

    await element.updateComplete

    const label = element.querySelector('span[data-expandable]') as HTMLElement

    expect(element.expanded).toBe(true)
    expect(label.dataset.expandable).toBe('false')
    expect(label.dataset.selected).toBe('true')

    label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await element.updateComplete

    expect(element.expanded).toBe(true)
  })

  it('renders nothing for hidden items and scrolls current items into view on update', async () => {
    const hidden = new MarkeeNavigationItem()
    hidden.item = {
      key: 'hidden.md',
      label: 'Hidden',
      hidden: true,
      link: '/hidden',
    } as any
    document.body.append(hidden)
    await hidden.updateComplete

    expect(hidden.innerHTML).toBe('<!---->')

    const current = new MarkeeNavigationItem()
    current.item = {
      key: 'page.md',
      label: 'Page',
      hidden: false,
      link: '/page',
    } as any
    document.body.append(current)
    await current.updateComplete

    current.current = true
    await current.updateComplete

    expect(scrollareaUtils.scrollToRef).toHaveBeenCalledWith(current)
  })

  it('initializes expansion when only defaults or selected are set before first render', async () => {
    const withDefaults = new MarkeeNavigationItem()
    withDefaults.defaults = { collapsible: true, expanded: true }
    document.body.append(withDefaults)
    await withDefaults.updateComplete

    expect(withDefaults.expanded).toBe(true)

    const withSelected = new MarkeeNavigationItem()
    withSelected.selected = true
    document.body.append(withSelected)
    await withSelected.updateComplete

    expect(withSelected.expanded).toBe(true)
  })
})

describe('MarkeeSideNavigation', () => {
  it('renders nothing when no root can be resolved or the ancestor depth is below the minimum', async () => {
    runtimeState.currentLoader = {
      data: { key: 'missing.md' } as any,
      error: null,
      loading: false,
    }

    const missing = new MarkeeSideNavigation()
    document.body.append(missing)
    await missing.updateComplete

    expect(missing.innerHTML).toBe('<!---->')

    const { docs } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: docs.key } as any,
      error: null,
      loading: false,
    }

    const tooShallow = new MarkeeSideNavigation()
    tooShallow.minRootSegments = 3
    document.body.append(tooShallow)
    await tooShallow.updateComplete

    expect(tooShallow.innerHTML).toBe('<!---->')
  })

  it('renders the resolved root label and nested subtree from the configured root segment', async () => {
    const { start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeSideNavigation()
    element.rootSegments = 2
    element.defaultExpanded = true
    element.defaultCollapsible = false
    document.body.append(element)

    await element.updateComplete

    const rootLabel = element.querySelector(':scope > a') as HTMLAnchorElement
    const rootLabelContent = rootLabel.querySelector(
      '[data-markable]',
    ) as HTMLElement & { content: string }
    const items = [
      ...element.querySelectorAll<MarkeeNavigationItem>('markee-navigation-item'),
    ]

    expect(element.getAttribute('aria-role')).toBe('navigation')
    expect(rootLabelContent.content).toBe('Docs')
    expect(rootLabel.getAttribute('href')).toBe('/docs')
    expect(items).toHaveLength(4)
    expect(items[1]?.selected).toBe(true)
    expect(items[2]?.current).toBe(true)
  })

  it('supports filtering, hiding the root label, and updating the filter from the input', async () => {
    const { start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeSideNavigation()
    element.rootSegments = 2
    element.showFilter = true
    element.hideRoot = true
    element.filterPlaceholder = 'Filter docs'
    document.body.append(element)

    await element.updateComplete

    const input = element.querySelector('input') as HTMLInputElement
    input.value = 'start'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await element.updateComplete

    expect(element.querySelector(':scope > a')).toBeNull()
    expect(input.getAttribute('placeholder')).toBe('Filter docs')
    expect(element.filter).toBe('start')
    expect(element.querySelectorAll('markee-navigation-item')).toHaveLength(2)
    expect(highlightUtils.highlight).toHaveBeenLastCalledWith(
      element,
      'start',
      false,
    )
  })

  it('syncs style variables from properties and removes them when those properties are cleared', async () => {
    const { start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeSideNavigation()
    element.minEntryWidth = '12rem'
    element.whiteSpace = 'nowrap'
    document.body.append(element)

    await element.updateComplete

    expect(element.style.getPropertyValue('--private-min-entry-width')).toBe(
      '12rem',
    )
    expect(element.style.getPropertyValue('--private-white-space')).toBe(
      'nowrap',
    )

    element.minEntryWidth = undefined
    element.whiteSpace = undefined
    await element.updateComplete

    expect(element.style.getPropertyValue('--private-min-entry-width')).toBe('')
    expect(element.style.getPropertyValue('--private-white-space')).toBe('')
  })

  it('falls back to an empty current key when the current loader has no data', async () => {
    const { root } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: null,
      error: null,
      loading: false,
    }
    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: (key: string) => (key === '' ? [root] : []),
      } as any,
    }

    const element = new MarkeeSideNavigation()
    document.body.append(element)
    await element.updateComplete

    expect(
      (
        element.querySelector(':scope > a [data-markable]') as HTMLElement & {
          content: string
        }
      ).content,
    ).toBe('Root')
  })
})
