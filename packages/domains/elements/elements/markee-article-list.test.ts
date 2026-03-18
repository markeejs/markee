import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeState = ((globalThis as any).__markeeArticleListRuntimeState ??= {
  navigation: { files: {} },
  current: { data: null },
})

vi.mock('@markee/runtime', async () => {
  const { LitElement } = await import('lit')

  function BooleanConverter(value: string | null) {
    if (value === 'false') return false
    return value != null
  }

  class TestMarkeeElement extends LitElement {
    static with(_options: { role?: string; stores?: unknown[] }) {
      return this
    }

    createRenderRoot() {
      return this
    }
  }

  return {
    BooleanConverter,
    MarkeeElement: TestMarkeeElement,
    state: {
      $navigation: {
        get: () => runtimeState.navigation,
      },
      $currentLoader: {
        get: () => runtimeState.current,
      },
    },
  }
})

const { MarkeeArticleList } = await import('./markee-article-list')

beforeEach(() => {
  runtimeState.navigation = { files: {} }
  runtimeState.current = { data: null }
  history.replaceState({}, '', '/')

  if (!customElements.get('test-article-card')) {
    customElements.define('test-article-card', class extends HTMLElement {})
  }

  if (!customElements.get('test-empty-state')) {
    customElements.define('test-empty-state', class extends HTMLElement {})
  }
})

describe('MarkeeArticleList.getOrder', () => {
  it('defaults to date and strips explicit sort prefixes', () => {
    expect(MarkeeArticleList.getOrder()).toBe('date')
    expect(MarkeeArticleList.getOrder('title')).toBe('title')
    expect(MarkeeArticleList.getOrder('+path')).toBe('path')
    expect(MarkeeArticleList.getOrder('-date')).toBe('date')
  })
})

describe('MarkeeArticleList.matchCandidate', () => {
  it('matches a single candidate case-insensitively', () => {
    expect(MarkeeArticleList.matchCandidate('Guides', ['guides', 'api'])).toBe(
      true,
    )
    expect(MarkeeArticleList.matchCandidate('Guides', ['api'])).toBe(false)
  })

  it('supports all: filters', () => {
    expect(
      MarkeeArticleList.matchCandidate('all:guides;api', ['Guides', 'API']),
    ).toBe(true)
    expect(MarkeeArticleList.matchCandidate('all:guides;api', ['guides'])).toBe(
      false,
    )
  })

  it('supports any: filters and missing arrays', () => {
    expect(MarkeeArticleList.matchCandidate('any:guides;api', ['reference'])).toBe(
      false,
    )
    expect(MarkeeArticleList.matchCandidate('any:guides;api', ['API'])).toBe(
      true,
    )
    expect(MarkeeArticleList.matchCandidate('guides')).toBe(false)
  })
})

describe('MarkeeArticleList.filterRule', () => {
  it('filters by folder, tags, and authors without a current file', () => {
    const files = {
      'docs/api/match.md': {
        frontMatter: {
          tags: ['API', 'Guides'],
          authors: ['Bob'],
        },
      },
      'docs/reference/miss.md': {
        frontMatter: {
          tags: ['Reference'],
          authors: ['Ada'],
        },
      },
    }

    const rule = MarkeeArticleList.filterRule(
      undefined,
      files as any,
      'docs/api',
      'all:api;guides',
      'any:bob;carol',
    )

    expect(rule('docs/api/match.md')).toBe(true)
    expect(rule('docs/reference/miss.md')).toBe(false)
  })

  it('supports the full set of filterSame rules', () => {
    const files = {
      'docs/api/current.md': {
        frontMatter: {
          authors: [' Ada ', 'Bob'],
          tags: [' API ', 'Guides'],
        },
      },
      'docs/api/match.md': {
        frontMatter: {
          authors: ['ada', 'bob'],
          tags: ['api', 'guides'],
        },
      },
      'docs/other/miss.md': {
        frontMatter: {
          authors: ['Ada'],
          tags: ['API'],
        },
      },
    }

    const rule = MarkeeArticleList.filterRule(
      'docs/api/current.md',
      files as any,
      undefined,
      undefined,
      undefined,
      'folder;root:2;authors:first;authors:any;authors:all;authors:exactly;tags:first;tags:any;tags:all;tags:exactly',
    )

    expect(rule('docs/api/match.md')).toBe(true)
    expect(rule('docs/other/miss.md')).toBe(false)
  })

  it('treats missing authors and tags as empty arrays in filterSame rules', () => {
    const files = {
      'docs/api/current.md': {
        frontMatter: {},
      },
      'docs/api/match.md': {
        frontMatter: {},
      },
    }

    const rule = MarkeeArticleList.filterRule(
      'docs/api/current.md',
      files as any,
      undefined,
      undefined,
      undefined,
      'authors:all;tags:all',
    )

    expect(rule('docs/api/match.md')).toBe(true)
  })
})

describe('markee-article-list', () => {
  function createElement() {
    const element = document.createElement(
      'markee-article-list',
    ) as MarkeeArticleList
    document.body.append(element)
    return element
  }

  it('renders nothing for an empty result set unless an empty element is configured', async () => {
    const element = createElement()
    await element.updateComplete
    expect(element.children).toHaveLength(0)

    element.emptyElement = 'test-empty-state'
    await element.requestUpdate()
    await element.updateComplete

    expect(element.querySelector('test-empty-state')).not.toBeNull()
  })

  it('sorts articles by path and hides hidden entries', async () => {
    runtimeState.navigation = {
      files: {
        'docs/b.md': {
          link: '/zeta',
          frontMatter: { title: 'B' },
        },
        'docs/a.md': {
          link: '/alpha',
          frontMatter: { title: 'A' },
        },
        'docs/hidden.md': {
          link: '/hidden',
          frontMatter: { hidden: true, title: 'Hidden' },
        },
      },
    }

    const element = createElement()
    element.order = 'path'
    await element.requestUpdate()
    await element.updateComplete

    expect(
      Array.from(element.querySelectorAll('markee-article')).map((article) =>
        article.getAttribute('data-article'),
      ),
    ).toEqual(['docs/a.md', 'docs/b.md'])
  })

  it('sorts path entries even when some links are missing', async () => {
    runtimeState.navigation = {
      files: {
        'docs/linked.md': {
          link: '/linked',
          frontMatter: { title: 'Linked' },
        },
        'docs/unlinked.md': {
          frontMatter: { title: 'Unlinked' },
        },
      },
    }

    const originalSort = Array.prototype.sort
    const sortSpy = vi
      .spyOn(Array.prototype, 'sort')
      .mockImplementation(function (compareFn) {
        compareFn?.('docs/linked.md', 'docs/unlinked.md')
        compareFn?.('docs/unlinked.md', 'docs/linked.md')
        return originalSort.call(this, compareFn as any)
      })

    const element = createElement()
    element.order = 'path'
    await element.requestUpdate()
    await element.updateComplete

    expect(
      Array.from(element.querySelectorAll('markee-article')).map((article) =>
        article.getAttribute('data-article'),
      ),
    ).toEqual(['docs/unlinked.md', 'docs/linked.md'])

    sortSpy.mockRestore()
  })

  it('sorts title entries even when some titles are missing', async () => {
    runtimeState.navigation = {
      files: {
        'docs/titled.md': {
          link: '/docs/titled',
          frontMatter: { title: 'Titled' },
        },
        'docs/untitled.md': {
          link: '/docs/untitled',
          frontMatter: {},
        },
      },
    }

    const originalSort = Array.prototype.sort
    const sortSpy = vi
      .spyOn(Array.prototype, 'sort')
      .mockImplementation(function (compareFn) {
        compareFn?.('docs/titled.md', 'docs/untitled.md')
        compareFn?.('docs/untitled.md', 'docs/titled.md')
        return originalSort.call(this, compareFn as any)
      })

    const element = createElement()
    element.order = 'title'
    await element.requestUpdate()
    await element.updateComplete

    expect(
      Array.from(element.querySelectorAll('markee-article')).map((article) =>
        article.getAttribute('data-article'),
      ),
    ).toEqual(['docs/untitled.md', 'docs/titled.md'])

    sortSpy.mockRestore()
  })

  it('sorts by date using modification and revision dates and tracks popstate', async () => {
    history.replaceState({}, '', '/?page=3')
    runtimeState.navigation = {
      files: {
        'posts/alpha.md': {
          link: '/posts/alpha',
          revisionDate: '2024-01-03',
          frontMatter: { title: 'Alpha', date: '2024-01-01' },
        },
        'posts/beta.md': {
          link: '/posts/beta',
          revisionDate: '2024-01-02',
          frontMatter: { title: 'Beta', date: '2024-01-01' },
        },
        'posts/gamma.md': {
          link: '/posts/gamma',
          frontMatter: { title: 'Gamma', modificationDate: '2024-01-04' },
        },
      },
    }

    const element = createElement()
    await element.updateComplete

    expect(element.page).toBe(3)
    expect(
      Array.from(element.querySelectorAll('markee-article')).map((article) =>
        article.getAttribute('data-article'),
      ),
    ).toEqual(['posts/gamma.md', 'posts/alpha.md', 'posts/beta.md'])

    history.replaceState({}, '', '/?page=2')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await element.updateComplete
    expect(element.page).toBe(2)

    history.replaceState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await element.updateComplete
    expect(element.page).toBe(1)

    element.remove()
    history.replaceState({}, '', '/?page=1')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(element.page).toBe(1)
  })

  it('falls back to revision dates when entries do not have dates', async () => {
    runtimeState.navigation = {
      files: {
        'posts/recent.md': {
          link: '/posts/recent',
          revisionDate: '2024-01-05',
          frontMatter: { title: 'Recent' },
        },
        'posts/older.md': {
          link: '/posts/older',
          revisionDate: '2024-01-04',
          frontMatter: { title: 'Older' },
        },
      },
    }

    const element = createElement()
    await element.updateComplete

    expect(
      Array.from(element.querySelectorAll('markee-article')).map((article) =>
        article.getAttribute('data-article'),
      ),
    ).toEqual(['posts/recent.md', 'posts/older.md'])
  })

  it('falls back to an empty revision date when needed', async () => {
    runtimeState.navigation = {
      files: {
        'posts/with-revision.md': {
          link: '/posts/with-revision',
          revisionDate: '2024-01-05',
          frontMatter: { title: 'With revision' },
        },
        'posts/without-revision.md': {
          link: '/posts/without-revision',
          frontMatter: { title: 'Without revision' },
        },
      },
    }

    const originalSort = Array.prototype.sort
    const sortSpy = vi
      .spyOn(Array.prototype, 'sort')
      .mockImplementation(function (compareFn) {
        compareFn?.('posts/with-revision.md', 'posts/without-revision.md')
        compareFn?.('posts/without-revision.md', 'posts/with-revision.md')
        return originalSort.call(this, compareFn as any)
      })

    const element = createElement()
    await element.updateComplete

    expect(
      Array.from(element.querySelectorAll('markee-article')).map((article) =>
        article.getAttribute('data-article'),
      ),
    ).toEqual(['posts/with-revision.md', 'posts/without-revision.md'])

    sortSpy.mockRestore()
  })

  it('renders custom article elements, page leads, reversed title order, and ellipsis pagination', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => {
        const rank = String(index + 1).padStart(2, '0')
        return [
          `posts/article-${rank}.md`,
          {
            link: `/posts/article-${rank}`,
            frontMatter: { title: `Article ${rank}` },
          },
        ]
      }),
    )

    runtimeState.navigation = { files }
    runtimeState.current = { data: { key: 'posts/article-11.md' } }

    const element = createElement()
    element.articleElement = 'test-article-card'
    element.order = '-title'
    element.pageLead = true
    element.pageSize = 1
    element.filterSame = 'folder'
    element.page = 5

    await element.requestUpdate()
    await element.updateComplete

    expect(
      element
        .querySelector('li[data-lead="true"] test-article-card')
        ?.getAttribute('data-article'),
    ).toBe('posts/article-10.md')
    expect(
      element
        .querySelector('ul li:not([data-lead="true"]) test-article-card')
        ?.getAttribute('data-article'),
    ).toBe('posts/article-05.md')
    expect(
      element.querySelectorAll(
        'markee-article-list-pagination span .fa-ellipsis',
      ),
    ).toHaveLength(2)

    const scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)
    const nextLink = element.querySelector(
      'markee-article-list-pagination a:last-child',
    ) as HTMLAnchorElement
    nextLink.addEventListener(
      'click',
      (event) => event.preventDefault(),
      { once: true, capture: true },
    )
    nextLink.click()
    await element.updateComplete

    expect(element.page).toBe(6)
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })
})
