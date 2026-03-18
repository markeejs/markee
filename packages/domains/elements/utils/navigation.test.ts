import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigationState = vi.hoisted(() => ({
  value: { files: {} as Record<string, any> },
}))

vi.mock('@markee/state', () => ({
  state: {
    $navigation: {
      get: () => navigationState.value,
    },
  },
}))

const {
  isItem,
  filterItem,
  containsItem,
  getFileFromLink,
  getVersionedFolderFileLink,
} = await import('./navigation')

beforeEach(() => {
  navigationState.value = { files: {} }
})

describe('isItem', () => {
  it('identifies items by key or indexKey', () => {
    expect(isItem({ key: 'docs/page' } as any, 'docs/page')).toBe(true)
    expect(
      isItem(
        { key: 'docs/folder', indexKey: 'docs/folder/index.md' } as any,
        'docs/folder/index.md',
      ),
    ).toBe(true)
    expect(isItem({ key: 'docs/page' } as any, 'docs/other')).toBe(false)
  })
})

describe('filterItem', () => {
  it('filters matching items while preserving matching subtrees', () => {
    const child = { key: 'docs/guide.md', label: 'Guide' }
    const sibling = { key: 'docs/api.md', label: 'API' }
    const parent = {
      key: 'docs',
      label: 'Docs',
      items: [child, sibling],
    }

    expect(filterItem(undefined, 'guide')).toEqual([])
    expect(filterItem(child as any, 'guide')).toEqual([child])
    expect(
      filterItem({ key: 'docs', label: 'Docs', items: [] } as any, 'docs'),
    ).toEqual([{ key: 'docs', label: 'Docs', items: [] }])
    expect(filterItem(parent as any, 'guide')).toEqual([
      { ...parent, items: [child] },
    ])
  })
})

describe('containsItem', () => {
  it('recursively checks folders, versions, and index files', () => {
    const versioned = {
      versions: [{ key: 'v2/page.md' }],
    }
    const deeplyVersioned = {
      key: 'docs',
      items: [
        {
          key: 'docs/platform',
          items: [
            {
              key: 'docs/platform/backend',
              items: [
                {
                  key: 'docs/platform/backend/guides',
                  versions: [
                    { key: 'docs/platform/backend/guides/v1/auth.md' },
                    { key: 'docs/platform/backend/guides/v2/auth.md' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const tree = {
      key: 'docs/folder',
      items: [{ key: 'docs/folder/topic.md' }],
    }

    expect(containsItem(versioned as any, 'v2/page.md')).toBe(true)
    expect(
      containsItem(
        deeplyVersioned as any,
        'docs/platform/backend/guides/v2/auth.md',
      ),
    ).toBe(true)
    expect(containsItem(tree as any, 'docs/folder/index.md')).toBe(true)
    expect(
      containsItem({ key: 'docs/folder', items: undefined } as any, 'missing'),
    ).toBe(false)
    expect(containsItem(tree as any, 'docs/folder/docs/folder.md')).toBe(false)
    expect(containsItem({ key: 'leaf.md' } as any, 'leaf.md')).toBe(true)
  })
})

describe('getFileFromLink', () => {
  it('finds files from canonical and alias links', () => {
    navigationState.value = {
      files: {
        'docs/guide.md': {
          link: '/docs/guide',
          alias: ['/guide', '/docs/guide/alt'],
          title: 'Guide',
        },
      },
    }

    expect(getFileFromLink('/docs/guide/')).toEqual({
      key: 'docs/guide.md',
      link: '/docs/guide',
      alias: ['/guide', '/docs/guide/alt'],
      title: 'Guide',
    })
    expect(getFileFromLink('/guide')).toEqual({
      key: 'docs/guide.md',
      link: '/docs/guide',
      alias: ['/guide', '/docs/guide/alt'],
      title: 'Guide',
    })
    expect(getFileFromLink('/missing')).toBeNull()
  })
})

describe('getVersionedFolderFileLink', () => {
  it('replaces the current version link with the target version link', () => {
    expect(
      getVersionedFolderFileLink(
        { link: '/v1/docs' } as any,
        { link: '/v2/docs' } as any,
        '/v1/docs/page',
      ),
    ).toBe('/v2/docs/page')
  })
})
