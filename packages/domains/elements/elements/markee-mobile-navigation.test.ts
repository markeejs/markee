import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import * as tocUtils from '../utils/table-of-contents'
import {
  MarkeeMobileNavigation,
  MarkeeMobileNavigationItem,
  MarkeeMobileNavigationToc,
} from './markee-mobile-navigation'

const runtimeState = {
  navigation: {
    tree: {
      getAncestorsForKey: () => [] as any[],
      getBranchByKey: () => null as any,
    },
  },
  currentLoader: {
    data: null,
    error: null,
    loading: false,
  } as ReturnType<typeof state.$currentLoader.get>,
}

function createNavigationFixtures() {
  const start: any = {
    key: 'docs/guide/start.md',
    label: 'Start',
    link: '/docs/guide/start',
    hidden: false,
  }
  const advanced: any = {
    key: 'docs/guide/advanced.md',
    label: 'Advanced',
    link: '/docs/guide/advanced',
    hidden: false,
  }
  const hidden: any = {
    key: 'docs/guide/hidden.md',
    label: 'Hidden',
    link: '/docs/guide/hidden',
    hidden: true,
  }
  const guide: any = {
    key: 'docs/guide',
    label: 'Guide',
    link: '/docs/guide',
    hidden: false,
    items: [start, advanced, hidden],
  }
  const intro: any = {
    key: 'docs/intro.md',
    label: 'Intro',
    link: '/docs/intro',
    hidden: false,
  }
  const api: any = {
    key: 'docs/api',
    label: 'API',
    link: '/docs/api',
    hidden: false,
    indexKey: 'docs/api/index.md',
  }
  const sdkGuide: any = {
    key: 'docs/sdk/guide.md',
    label: 'SDK Guide',
    link: '/docs/sdk/guide',
    hidden: false,
  }
  const sdk: any = {
    key: 'docs/sdk',
    label: 'SDK',
    link: '/docs/sdk',
    hidden: false,
    indexKey: 'docs/sdk/index.md',
    items: [sdkGuide],
  }
  const docs: any = {
    key: 'docs',
    label: 'Docs',
    link: '/docs',
    hidden: false,
    items: [intro, guide, api, sdk],
  }
  const root: any = {
    key: 'root',
    label: 'Root',
    hidden: false,
    items: [docs],
  }
  const orphan: any = {
    key: 'orphan.md',
    label: 'Orphan',
    link: '/orphan',
    hidden: false,
  }

  docs.parent = root as any
  guide.parent = docs as any
  intro.parent = docs as any
  api.parent = docs as any
  sdk.parent = docs as any
  start.parent = guide as any
  advanced.parent = guide as any
  hidden.parent = guide as any
  sdkGuide.parent = sdk as any

  const branchMap: Record<string, any> = {
    [root.key]: root,
    [docs.key]: docs,
    [guide.key]: guide,
    [api.key]: api,
    [sdk.key]: sdk,
    [orphan.key]: orphan,
  }

  const ancestorMap: Record<string, any[]> = {
    [root.key]: [root],
    [docs.key]: [root, docs],
    [guide.key]: [root, docs, guide],
    [intro.key]: [root, docs, intro],
    [start.key]: [root, docs, guide, start],
    [advanced.key]: [root, docs, guide, advanced],
    [hidden.key]: [root, docs, guide, hidden],
    [api.key]: [root, docs, api],
    [api.indexKey]: [root, docs, api],
    [sdk.key]: [root, docs, sdk],
    [sdk.indexKey]: [root, docs, sdk],
    [sdkGuide.key]: [root, docs, sdk, sdkGuide],
    [orphan.key]: [orphan],
    'orphan-view': [orphan],
  }

  runtimeState.navigation = {
    tree: {
      getAncestorsForKey: ((key: string) => ancestorMap[key] ?? []) as any,
      getBranchByKey: ((key: string) => branchMap[key] ?? null) as any,
    },
  }

  return {
    root,
    docs,
    guide,
    intro,
    start,
    advanced,
    hidden,
    api,
    sdk,
    sdkGuide,
    orphan,
  }
}

function getDrawer(element: HTMLElement) {
  const drawer = element.querySelector('markee-drawer')
  if (!(drawer instanceof HTMLElement)) {
    throw new Error('markee-drawer not found')
  }
  return drawer as HTMLElement & { open?: boolean; side?: string }
}

function getHeaderButtons(element: HTMLElement) {
  return [...element.querySelectorAll('header button')]
}

beforeEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''

  runtimeState.navigation = {
    tree: {
      getAncestorsForKey: () => [],
      getBranchByKey: () => null,
    },
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
  vi.spyOn(state.$router, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(tocUtils, 'getHeaders').mockReturnValue([])
})

describe('MarkeeMobileNavigationToc', () => {
  it('renders the entry link and nested children', async () => {
    const element = new MarkeeMobileNavigationToc()
    element.header = {
      id: 'intro',
      label: 'Intro',
      passed: false,
      active: false,
      current: false,
      items: [
        {
          id: 'child',
          label: 'Child',
          passed: false,
          active: false,
          current: false,
          items: [],
        },
      ],
    }
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('#intro')
    expect(element.querySelector('a')?.textContent?.trim()).toBe('Intro')
    expect(element.querySelector('ul')).not.toBeNull()
    expect(element.querySelectorAll('markee-mobile-navigation-toc')).toHaveLength(1)
  })

  it('renders a leaf entry without nested markup', async () => {
    const element = new MarkeeMobileNavigationToc()
    element.header = {
      id: 'leaf',
      label: 'Leaf',
      passed: false,
      active: false,
      current: false,
      items: [],
    }
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('#leaf')
    expect(element.querySelector('ul')).toBeNull()
  })
})

describe('MarkeeMobileNavigationItem', () => {
  it('renders a linked expandable item and dispatches open-children from the button', async () => {
    const onOpenChildren = vi.fn()
    const onParentClick = vi.fn()
    const wrapper = document.createElement('div')
    const element = new MarkeeMobileNavigationItem()
    element.item = {
      key: 'docs/guide',
      label: 'Guide',
      link: '/docs/guide',
      hidden: false,
      items: [{ key: 'docs/guide/start.md', label: 'Start', hidden: false }],
    } as any

    wrapper.addEventListener('open-children', onOpenChildren)
    wrapper.addEventListener('click', onParentClick)
    wrapper.append(element)
    document.body.append(wrapper)

    await element.updateComplete

    const button = element.querySelector('button')
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('expand button not found')
    }

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/docs/guide')
    expect(button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false)
    expect(onOpenChildren).toHaveBeenCalledOnce()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('renders an item with an empty children array without href or expand button', async () => {
    const element = new MarkeeMobileNavigationItem()
    element.item = {
      key: 'leaf',
      label: 'Leaf',
      hidden: false,
      items: [],
    } as any
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBeNull()
    expect(element.querySelector('button')).toBeNull()
  })

  it('renders an item without an items property as a non-expandable link', async () => {
    const element = new MarkeeMobileNavigationItem()
    element.item = {
      key: 'intro',
      label: 'Intro',
      hidden: false,
      link: '/intro',
    } as any
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/intro')
    expect(element.querySelector('button')).toBeNull()
  })

  it('treats an undefined items field as non-expandable', async () => {
    const element = new MarkeeMobileNavigationItem()
    element.item = {
      key: 'maybe-group',
      label: 'Maybe Group',
      hidden: false,
      items: undefined,
    } as any
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('button')).toBeNull()
  })
})

describe('MarkeeMobileNavigation', () => {
  it('renders the parent tree for the current file, filters hidden items, and binds drawer props', async () => {
    const { start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeMobileNavigation()
    element.position = 'right'
    document.body.append(element)

    await element.updateComplete

    const drawer = getDrawer(element)
    const listItems = [...element.querySelectorAll<HTMLLIElement>('nav > ul > li')]

    expect(element.shownPath).toBe(start.key)
    expect(element.opened).toBe(false)
    expect(drawer.side).toBe('right')
    expect(drawer.open).toBe(false)
    expect(element.querySelector('header span')?.textContent).toBe('Guide')
    expect(element.querySelectorAll('markee-mobile-navigation-item')).toHaveLength(2)
    expect(listItems).toHaveLength(2)
    expect(listItems[0]?.dataset.selected).toBe('true')
    expect(listItems[1]?.dataset.selected).toBe('false')
    expect(element.textContent).not.toContain('Hidden')
  })

  it('navigates into child groups from open-children events and back to the root view', async () => {
    const { docs, root, start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeMobileNavigation()
    element.rootSegments = 1
    document.body.append(element)

    await element.updateComplete

    element.shownPath = root.key
    await element.updateComplete

    expect(getHeaderButtons(element)).toHaveLength(1)
    expect(element.querySelector('header span')?.textContent).toBe('Root')

    const firstItem = element.querySelector('markee-mobile-navigation-item')
    if (!(firstItem instanceof MarkeeMobileNavigationItem)) {
      throw new Error('navigation item not found')
    }

    firstItem.dispatchEvent(
      new CustomEvent('open-children', { bubbles: true, composed: true }),
    )
    await element.updateComplete

    expect(element.shownPath).toBe(docs.key)
    expect(element.querySelector('header span')?.textContent).toBe('Docs')
    expect(getHeaderButtons(element)).toHaveLength(2)

    getHeaderButtons(element)[0]?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete

    expect(element.shownPath).toBe(root.key)
    expect(element.querySelector('header span')?.textContent).toBe('Root')
  })

  it('updates open state from drawer changes, resets the shown path, and closes from the header button', async () => {
    const { docs, start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeMobileNavigation()
    document.body.append(element)

    await element.updateComplete

    element.shownPath = docs.key
    await element.updateComplete

    const drawer = getDrawer(element)
    drawer.open = true
    drawer.dispatchEvent(new Event('change'))
    await element.updateComplete

    expect(element.opened).toBe(true)
    expect(element.shownPath).toBe(start.key)

    getHeaderButtons(element).at(-1)?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete

    expect(element.opened).toBe(false)
  })

  it('renders the table of contents for the current file and closes when a TOC entry is clicked', async () => {
    const { start } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: start.key } as any,
      error: null,
      loading: false,
    }
    vi.spyOn(tocUtils, 'getHeaders').mockReturnValue([
      {
        id: 'intro',
        label: 'Intro',
        passed: false,
        active: true,
        current: true,
        items: [],
      },
    ])

    const element = new MarkeeMobileNavigation()
    document.body.append(element)

    await element.updateComplete

    element.opened = true
    await element.updateComplete

    const tocEntry = element.querySelector('markee-mobile-navigation-toc')
    if (!(tocEntry instanceof MarkeeMobileNavigationToc)) {
      throw new Error('toc entry not found')
    }

    expect(element.querySelectorAll('markee-mobile-navigation-item')).toHaveLength(0)
    expect(element.querySelector('header span')?.textContent).toBe('Start')

    tocEntry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await element.updateComplete

    expect(element.opened).toBe(false)
  })

  it('shows the table of contents for index-backed sections without child items', async () => {
    const { api } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: api.indexKey } as any,
      error: null,
      loading: false,
    }
    vi.spyOn(tocUtils, 'getHeaders').mockReturnValue([
      {
        id: 'overview',
        label: 'Overview',
        passed: false,
        active: true,
        current: true,
        items: [],
      },
    ])

    const element = new MarkeeMobileNavigation()
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('header span')?.textContent).toBe('API')
    expect(element.querySelectorAll('markee-mobile-navigation-toc')).toHaveLength(1)
  })

  it('keeps index-backed sections with child items in navigation mode', async () => {
    const { sdk } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: sdk.indexKey } as any,
      error: null,
      loading: false,
    }
    vi.mocked(tocUtils.getHeaders).mockReturnValue([
      {
        id: 'overview',
        label: 'Overview',
        passed: false,
        active: true,
        current: true,
        items: [],
      },
    ])

    const element = new MarkeeMobileNavigation()
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('header span')?.textContent).toBe('SDK')
    expect(element.querySelectorAll('markee-mobile-navigation-toc')).toHaveLength(0)
    expect(element.querySelectorAll('markee-mobile-navigation-item')).toHaveLength(1)
  })

  it('keeps the current path when back navigation has no parent target', async () => {
    const { orphan } = createNavigationFixtures()
    runtimeState.currentLoader = {
      data: { key: orphan.key } as any,
      error: null,
      loading: false,
    }

    const element = new MarkeeMobileNavigation()
    element.rootSegments = 2
    document.body.append(element)

    await element.updateComplete

    element.shownPath = 'orphan-view'
    await element.updateComplete

    expect(element.querySelector('header span')?.textContent).toBe('Orphan')

    getHeaderButtons(element)[0]?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete

    expect(element.shownPath).toBe('orphan-view')
  })

  it('renders only the drawer trigger when there is no current tree to show', async () => {
    vi.mocked(tocUtils.getHeaders).mockReturnValue([])

    const element = new MarkeeMobileNavigation()
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('markee-drawer')).not.toBeNull()
    expect(element.querySelector('header')).toBeNull()
    expect(element.querySelector('nav')).toBeNull()
  })
})
