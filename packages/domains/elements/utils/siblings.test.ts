import { beforeEach, describe, expect, it, vi } from 'vitest'
import { state } from '@markee/state'
import { $siblings } from './siblings'

const siblingsState = {
  current: { data: null as any },
  navigation: { files: {}, tree: null as any },
}

function notifyStores() {
  state.$currentLoader.notify(undefined)
  state.$navigation.notify(undefined)
}

beforeEach(() => {
  vi.restoreAllMocks()
  siblingsState.current = { data: null }
  siblingsState.navigation = { files: {}, tree: null }
  vi.spyOn(state.$currentLoader, 'get').mockImplementation(
    () => siblingsState.current as any,
  )
  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => siblingsState.navigation as any,
  )
  notifyStores()
})

describe('$siblings', () => {
  function createNavigationTree() {
    const intro = { key: 'intro.md', link: '/intro', hidden: false }
    const guideStart = {
      key: 'guide/start.md',
      link: '/guide/start',
      hidden: false,
    }
    const guideAdvanced = {
      key: 'guide/advanced.md',
      link: '/guide/advanced',
      hidden: false,
    }
    const apiAuth = {
      key: 'guide/api/auth.md',
      link: '/guide/api/auth',
      hidden: false,
    }
    const apiHooks = {
      key: 'guide/api/hooks.md',
      link: '/guide/api/hooks',
      hidden: false,
    }
    const guideApi = {
      key: 'guide/api',
      indexKey: 'guide/api/index.md',
      link: '/guide/api',
      hidden: false,
      items: [apiAuth, apiHooks],
    }
    const guides = {
      key: 'guide',
      indexKey: 'guide/index.md',
      link: '/guide',
      hidden: false,
      items: [guideStart, guideAdvanced, guideApi],
    }
    const blogRelease = {
      key: 'blog/release.md',
      link: '/blog/release',
      hidden: false,
    }
    const blogChangelog = {
      key: 'blog/changelog.md',
      link: '/blog/changelog',
      hidden: false,
    }
    const blog = {
      key: 'blog',
      indexKey: 'blog/index.md',
      link: '/blog',
      hidden: false,
      items: [blogRelease, blogChangelog],
    }
    const reference = {
      key: 'reference.md',
      link: '/reference',
      hidden: false,
    }
    const hidden = { key: 'hidden.md', link: '/hidden', hidden: true }
    const items = [intro, guides, hidden, blog, reference]
    const root = {
      key: 'root',
      link: '/root',
      hidden: true,
      items,
      getBranchByKey(key: string) {
        const visit = (item: any): any => {
          if (item.key === key || item.indexKey === key) return item
          if ('items' in item && item.items) {
            for (const child of item.items) {
              const match = visit(child)
              if (match) return match
            }
          }
          return null
        }

        for (const item of items) {
          const match = visit(item)
          if (match) return match
        }

        return null
      },
    }

    return {
      root,
      files: {
        'intro.md': { title: 'Intro' },
        'guide/index.md': { title: 'Guide' },
        'guide/start.md': { title: 'Start' },
        'guide/advanced.md': { title: 'Advanced' },
        'guide/api/index.md': { title: 'API' },
        'guide/api/auth.md': { title: 'Auth' },
        'guide/api/hooks.md': { title: 'Hooks' },
        'blog/index.md': { title: 'Blog' },
        'blog/release.md': { title: 'Release' },
        'blog/changelog.md': { title: 'Changelog' },
        'reference.md': { title: 'Reference' },
      },
    }
  }

  it('returns null siblings when there is no current key or no matching file', () => {
    expect($siblings.get()).toEqual({ previous: null, next: null })

    siblingsState.current = { data: { key: 'missing' } }
    siblingsState.navigation = {
      files: {},
      tree: {
        items: [],
        getBranchByKey: () => null,
      },
    }
    notifyStores()

    expect($siblings.get()).toEqual({ previous: null, next: null })
  })

  it('selects the visible previous and next siblings from a larger tree', () => {
    const { root, files } = createNavigationTree()

    siblingsState.current = { data: { key: 'guide/api/index.md' } }
    siblingsState.navigation = { files, tree: root }
    notifyStores()

    expect($siblings.get()).toEqual({
      previous: { key: 'guide/advanced.md', file: { title: 'Advanced' } },
      next: { key: 'guide/api/auth.md', file: { title: 'Auth' } },
    })
  })

  it('can resolve a previous sibling from a different parent folder', () => {
    const { root, files } = createNavigationTree()

    siblingsState.current = { data: { key: 'blog/index.md' } }
    siblingsState.navigation = { files, tree: root }
    notifyStores()

    expect($siblings.get()).toEqual({
      previous: { key: 'guide/api/hooks.md', file: { title: 'Hooks' } },
      next: { key: 'blog/release.md', file: { title: 'Release' } },
    })
  })

  it('can resolve a next sibling from a different parent folder', () => {
    const { root, files } = createNavigationTree()

    siblingsState.current = { data: { key: 'guide/api/hooks.md' } }
    siblingsState.navigation = { files, tree: root }
    notifyStores()

    expect($siblings.get()).toEqual({
      previous: { key: 'guide/api/auth.md', file: { title: 'Auth' } },
      next: { key: 'blog/index.md', file: { title: 'Blog' } },
    })
  })

  it('returns null when there is no previous or no next visible sibling', () => {
    const { root, files } = createNavigationTree()

    siblingsState.navigation = { files, tree: root }

    siblingsState.current = { data: { key: 'intro.md' } }
    notifyStores()
    expect($siblings.get()).toEqual({
      previous: { key: undefined, file: undefined },
      next: { key: 'guide/index.md', file: { title: 'Guide' } },
    })

    siblingsState.current = { data: { key: 'reference.md' } }
    notifyStores()
    expect($siblings.get()).toEqual({
      previous: { key: 'blog/changelog.md', file: { title: 'Changelog' } },
      next: { key: undefined, file: undefined },
    })
  })

  it('ignores null tree entries while flattening siblings', () => {
    const first = { key: 'first.md', link: '/first', hidden: false }
    const last = { key: 'last.md', link: '/last', hidden: false }
    const root = {
      key: 'root',
      link: '/root',
      hidden: true,
      items: [first, null as any, last],
      getBranchByKey(key: string) {
        return [first, last].find((item) => item.key === key) ?? null
      },
    }

    siblingsState.current = { data: { key: 'first.md' } }
    siblingsState.navigation = {
      files: {
        'first.md': { title: 'First' },
        'last.md': { title: 'Last' },
      },
      tree: root,
    }
    notifyStores()

    expect($siblings.get()).toEqual({
      previous: { key: undefined, file: undefined },
      next: { key: 'last.md', file: { title: 'Last' } },
    })
  })
})
