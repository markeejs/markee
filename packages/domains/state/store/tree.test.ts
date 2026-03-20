import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../cache.js', () => ({
  cache: vi.fn(),
}))

import { $router } from './router.js'
import { $navigationLoader } from './metadata.js'
import { $navigationTree } from './tree.js'

function markdownFile(link: string, title: string) {
  return {
    link,
    layout: 'docs',
    frontMatter: {
      title,
      excerpt: '',
    },
    readingTime: 0,
    payload: {},
  } as MarkdownFile
}

beforeEach(() => {
  sessionStorage.clear()
  $router.open('/')
  $navigationLoader.set({
    loading: false,
    data: { files: {}, folders: {}, assets: {} },
    error: null,
  })
})

describe('$navigationTree', () => {
  it('builds branches, hides excluded items, keeps external links, and resolves ancestors', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'intro.md': markdownFile('/intro', 'Intro'),
          'hidden.md': markdownFile('/hidden', 'Hidden'),
          'guides/index.md': markdownFile('/guides', 'Guides'),
          'guides/page.md': markdownFile('/guides/page', 'Page'),
        },
        folders: {
          '/': {
            navigation: [
              { key: 'intro.md' },
              { key: 'guides' },
              { key: 'https://example.com', title: 'External' },
            ],
            excluded: [{ key: 'hidden.md' }],
          } as any,
          'guides': {
            navigation: [{ key: 'guides/index.md' }, { key: 'guides/page.md' }],
            title: 'Guides',
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const tree = $navigationTree.get()
    const guides = tree.getBranchByKey('guides') as TreeItem
    const hidden = tree.getBranchByKey('hidden.md') as TreeLeaf

    expect(tree.items?.map((item: TreeItem | TreeLeaf) => item.key)).toEqual([
      'intro.md',
      'guides',
      'https://example.com',
      'hidden.md',
    ])
    expect(guides.link).toBe('/guides')
    expect(guides.indexKey).toBe('guides/index.md')
    expect(guides.items?.[0]?.parent).toBe(guides)
    expect(hidden.hidden).toBe(true)
    expect(tree.getBranchByKey('https://example.com')?.link).toBe(
      'https://example.com',
    )
    expect(
      tree
        .getAncestorsForKey('guides/page.md')
        .map((item: TreeItem | TreeLeaf) => item.key),
    ).toEqual(['/', 'guides', 'guides/page.md'])
    expect(tree.getBranchByKey('missing')).toBeNull()
  })

  it('drops empty folders and recomputes branches when reloaded', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guides/index.md': markdownFile('/guides', 'Guides'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'guides' }, { key: 'empty' }],
          } as any,
          'guides': {
            navigation: [{ key: 'guides/index.md' }],
          } as any,
          'empty': {
            navigation: [],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const initial = $navigationTree.get()
    expect(initial.items?.map((item: TreeItem | TreeLeaf) => item.key)).toEqual(
      ['guides'],
    )
    expect(initial.getBranchByKey('empty')).toBeNull()

    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guides/index.md': markdownFile('/guides', 'Guides'),
          'guides/page.md': markdownFile('/guides/page', 'Page'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'guides' }],
          } as any,
          'guides': {
            navigation: [{ key: 'guides/index.md' }, { key: 'guides/page.md' }],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    initial.reload()

    expect($navigationTree.get().getBranchByKey('guides/page.md')?.link).toBe(
      '/guides/page',
    )
  })

  it('selects the saved version for versioned folders and exposes canonical links', () => {
    sessionStorage.setItem('markee::versioned-content::docs', 'docs/v2')
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'docs/v1/index.md': markdownFile('/docs/v1', 'Docs v1'),
          'docs/v1/page.md': markdownFile('/docs/v1/page', 'Page v1'),
          'docs/v2/index.md': markdownFile('/docs/v2', 'Docs v2'),
          'docs/v2/page.md': markdownFile('/docs/v2/page', 'Page v2'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'docs' }],
          } as any,
          'docs': {
            title: 'Docs',
            version: { folder: true },
            versions: [{ key: 'docs/v1' }, { key: 'docs/v2' }],
            navigation: [],
          } as any,
          'docs/v1': {
            navigation: [
              { key: 'docs/v1/index.md' },
              { key: 'docs/v1/page.md' },
            ],
            title: 'Version 1',
          } as any,
          'docs/v2': {
            navigation: [
              { key: 'docs/v2/index.md' },
              { key: 'docs/v2/page.md' },
            ],
            title: 'Version 2',
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const docs = $navigationTree.get().getBranchByKey('docs') as TreeItem

    expect(docs.label).toBe('Docs')
    expect(docs.link).toBe('/docs/v2')
    expect(docs.indexKey).toBe('docs/v2/index.md')
    expect(docs.items?.map((item) => item.key)).toEqual(['docs/v2/page.md'])
    expect(docs.canonicalLink).toBe('/docs/v1')
    expect(docs.outdated).toBe('/docs/v1')
  })

  it('derives canonical links from nested version items when the version root has no link', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'docs/v1/page.md': markdownFile('/docs/v1/page', 'Page v1'),
          'docs/v2/index.md': markdownFile('/docs/v2', 'Docs v2'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'docs' }],
          } as any,
          'docs': {
            version: { folder: true },
            versions: [{ key: 'docs/v1' }, { key: 'docs/v2' }],
            navigation: [],
          } as any,
          'docs/v1': {
            navigation: [{ key: 'docs/v1/page.md' }],
          } as any,
          'docs/v2': {
            navigation: [{ key: 'docs/v2/index.md' }],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const docs = $navigationTree.get().getBranchByKey('docs') as TreeItem
    expect(docs.canonicalLink).toBe('/docs/v1/page')
  })

  it('uses the current file when no saved version is present', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'docs/v1/index.md': markdownFile('/docs/v1', 'Docs v1'),
          'docs/v2/index.md': markdownFile('/docs/v2', 'Docs v2'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'docs' }],
          } as any,
          'docs': {
            version: { folder: true },
            versions: [{ key: 'docs/v1' }, { key: 'docs/v2' }],
            navigation: [],
          } as any,
          'docs/v1': {
            navigation: [{ key: 'docs/v1/index.md' }],
          } as any,
          'docs/v2': {
            navigation: [{ key: 'docs/v2/index.md' }],
          } as any,
        },
        assets: {},
      },
      error: null,
    })
    $router.open('/docs/v2')

    const docs = $navigationTree.get().getBranchByKey('docs') as TreeItem
    expect(docs.link).toBe('/docs/v2')
  })

  it('selects the saved version for versioned leaves and marks outdated content', () => {
    sessionStorage.setItem('markee::versioned-content::guide', 'guide/v2.md')
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide/v1.md': markdownFile('/guide/v1', 'Guide v1'),
          'guide/v2.md': markdownFile('/guide/v2', 'Guide v2'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'guide' }],
          } as any,
          'guide': {
            title: 'Guide',
            version: { folder: false },
            versions: [{ key: 'guide/v1.md' }, { key: 'guide/v2.md' }],
            navigation: [],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const guide = $navigationTree.get().getBranchByKey('guide') as TreeItem

    expect(guide.key).toBe('guide/v2.md')
    expect(guide.label).toBe('Guide')
    expect(guide.link).toBe('/guide/v2')
    expect(guide.outdated).toBe('/guide/v1')
  })

  it('falls back to the first version and to empty navigation data when needed', () => {
    sessionStorage.setItem('markee::versioned-content::guide', 'missing.md')
    $navigationLoader.set({
      loading: false,
      data: null,
      error: null,
    })

    expect($navigationTree.get().getBranchByKey('anything')).toBeNull()
    expect($navigationTree.get().getAncestorsForKey('anything')).toEqual([])

    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide/v1.md': markdownFile('/guide/v1', 'Guide v1'),
          'guide/v2.md': markdownFile('/guide/v2', 'Guide v2'),
        },
        folders: {
          '/': {
            navigation: [{ key: 'guide' }],
          } as any,
          'guide': {
            version: { folder: false },
            versions: [{ key: 'guide/v1.md' }, { key: 'guide/v2.md' }],
            navigation: [],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const guide = $navigationTree.get().getBranchByKey('guide') as TreeItem
    expect(guide.key).toBe('guide/v1.md')
  })

  it('falls back to inferred titles and empty leaf labels when metadata is sparse', () => {
    sessionStorage.removeItem('markee::versioned-content::guide')
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'group/child.md': {
            link: '/group/child',
            layout: 'docs',
            frontMatter: {
              excerpt: '',
            },
            readingTime: 0,
            payload: {},
          } as any,
          'guide/v1.md': {
            link: '/guide/v1',
            layout: 'docs',
            frontMatter: {
              excerpt: '',
            },
            readingTime: 0,
            payload: {},
          } as any,
          'plain.md': {
            link: '/plain',
            layout: 'docs',
            frontMatter: {
              excerpt: '',
            },
            readingTime: 0,
            payload: {},
          } as any,
        },
        folders: {
          '/': {
            navigation: [
              { key: 'group' },
              { key: 'guide' },
              { key: 'plain.md' },
            ],
          } as any,
          'group': {
            inferredTitle: 'Group',
            navigation: [{ key: 'group/child.md' }],
          } as any,
          'guide': {
            version: {},
            versions: [{ key: 'guide/v1.md' }],
            navigation: [],
          } as any,
          'titled': {
            collapsible: false,
            navigation: [{ key: 'titled/page.md' }],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const root = $navigationTree.get()
    const group = root.getBranchByKey('group') as TreeItem
    const guide = root.getBranchByKey('guide') as TreeItem
    const plain = root.getBranchByKey('plain.md') as TreeLeaf

    expect(group.label).toBe('Group')
    expect(guide.versionLabel).toBeUndefined()
    expect((guide as any).collapsible).toBeUndefined()
    expect(guide.label).toBe('')
    expect(plain.label).toBe('')
    expect(plain.versionLabel).toBeUndefined()
  })

  it('uses index titles as a fallback label and keeps explicit version metadata', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'titled/index.md': {
            link: '/titled',
            layout: 'docs',
            frontMatter: {
              title: 'Titled',
              excerpt: '',
            },
            readingTime: 0,
            payload: {},
          } as any,
          'titled/page.md': {
            link: '/titled/page',
            layout: 'docs',
            frontMatter: {
              excerpt: '',
              version: { name: 'v1' },
            },
            readingTime: 0,
            payload: {},
          } as any,
        },
        folders: {
          '/': {
            navigation: [{ key: 'titled' }],
          } as any,
          'titled': {
            collapsible: false,
            navigation: [{ key: 'titled/page.md' }],
          } as any,
        },
        assets: {},
      },
      error: null,
    })

    const titled = $navigationTree.get().getBranchByKey('titled') as TreeItem
    const page = $navigationTree
      .get()
      .getBranchByKey('titled/page.md') as TreeLeaf

    expect(titled.label).toBe('Titled')
    expect(titled.collapsible).toBe(false)
    expect(page.versionLabel).toBe('v1')
  })
})
