import type { SearchResult } from '@markee/state'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { extend, state } from '@markee/runtime'
import { markApi } from '../utils/mark'
import {
  MarkeeSearch,
  MarkeeSearchFile,
  MarkeeSearchSection,
} from './markee-search'

const runtimeState = {
  navigation: {
    tree: {
      getAncestorsForKey: () => [] as any[],
    },
    files: {} as Record<string, any>,
  },
  router: {
    navigate: {
      open: vi.fn(),
      replace: vi.fn(),
    },
  } as ReturnType<typeof state.$router.get>,
  search: undefined as unknown as ReturnType<typeof state.$search.get>,
}

function createSearchFn(results: SearchResult[] = []) {
  const search = vi.fn(() => results) as ReturnType<typeof state.$search.get> &
    ReturnType<typeof vi.fn>
  search.anyOf = vi.fn((field, values, strategy) => ({
    kind: 'anyOf',
    field,
    values,
    strategy,
  })) as any
  search.allOf = vi.fn((field, values, strategy) => ({
    kind: 'allOf',
    field,
    values,
    strategy,
  })) as any

  return search
}

function normalizeText(text: string | null | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

beforeEach(() => {
  vi.restoreAllMocks()

  runtimeState.navigation = {
    tree: {
      getAncestorsForKey: () => [],
    },
    files: {},
  }
  runtimeState.router = {
    navigate: {
      open: vi.fn(),
      replace: vi.fn(),
    },
  } as ReturnType<typeof state.$router.get>
  runtimeState.search = createSearchFn()

  extend.search.getShardingKeys = undefined
  extend.search.groupResults = undefined

  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => runtimeState.navigation as any,
  )
  vi.spyOn(state.$navigation, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$router, 'get').mockImplementation(() => runtimeState.router)
  vi.spyOn(state.$search, 'get').mockImplementation(() => runtimeState.search)
  vi.spyOn(state.$search, 'subscribe').mockImplementation(() => () => {})

  vi.spyOn(markApi, 'create').mockImplementation(() => {
    const mark = vi.fn((_: string, options?: { done?: () => void }) => {
      options?.done?.()
    })

    return { mark } as any
  })
})

describe('MarkeeSearchFile', () => {
  function setAncestors() {
    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: () => [
          { key: 'root', label: 'Root', link: '/root' },
          { key: 'docs', label: 'Docs', link: '/docs' },
          { key: 'guides', label: 'Guides', link: '/docs/guides' },
          { key: 'guide.md', label: 'Guide', link: '/docs/guides/guide' },
        ],
      },
      files: {
        'guide.md': {
          frontMatter: {
            tags: ['API', 'UI'],
          },
        },
      },
    }
  }

  it('renders nothing when the navigation file or primary result is missing', async () => {
    const missingFile = new MarkeeSearchFile()
    missingFile.file = 'missing.md'
    missingFile.results = [
      { label: 'Intro', anchor: '#intro', content: 'Body' },
    ]
    document.body.append(missingFile)
    await missingFile.updateComplete

    expect(missingFile.innerHTML).toBe('<!---->')

    setAncestors()
    const missingPrimary = new MarkeeSearchFile()
    missingPrimary.file = 'guide.md'
    missingPrimary.results = []
    document.body.append(missingPrimary)
    await missingPrimary.updateComplete

    expect(missingPrimary.innerHTML).toBe('<!---->')
  })

  it('renders breadcrumbs, tags, links, toggles extra results, and emits result-selection events', async () => {
    setAncestors()
    const onSelected = vi.fn()
    const element = new MarkeeSearchFile()
    element.file = 'guide.md'
    element.search = 'guide api'
    element.results = [
      { label: 'Intro', anchor: '#intro', content: 'Primary body' },
      { label: 'Usage', anchor: '#usage', content: 'Secondary body' },
      { label: 'API', anchor: '#api', content: 'Tertiary body' },
    ]
    element.addEventListener('search-result-selected', onSelected)
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('strong')?.textContent?.trim()).toBe('Guide')
    expect(
      [...element.querySelectorAll('div > span:not([data-separator])')]
        .slice(0, 2)
        .map((span) => span.textContent),
    ).toEqual(['Docs', 'Guides'])
    expect(element.querySelectorAll('[data-separator]')).toHaveLength(1)
    expect(element.querySelectorAll('[data-markable]')).toHaveLength(8)
    expect(element.querySelector('[data-result]')?.getAttribute('href')).toBe(
      '/docs/guides/guide#intro',
    )
    expect(normalizeText(element.querySelector('button')?.textContent)).toBe(
      'Show 2 more results',
    )
    expect(
      element.querySelector('markee-collapse')?.hasAttribute('hidden'),
    ).toBe(true)
    expect(markApi.create).toHaveBeenCalled()

    element.querySelector('button')?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete

    expect(normalizeText(element.querySelector('button')?.textContent)).toBe(
      'Hide 2 more results',
    )
    expect(
      element.querySelector('markee-collapse')?.hasAttribute('hidden'),
    ).toBe(false)

    const extraResult = element.querySelectorAll('[data-result]')[1]
    extraResult?.addEventListener('click', (event) => event.preventDefault())
    extraResult?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
    expect(onSelected).toHaveBeenCalledOnce()
  })

  it('omits tags and extra-results controls when they are absent', async () => {
    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: () => [
          { key: 'root', label: 'Root', link: '/root' },
          { key: 'solo.md', label: 'Solo', link: '/solo' },
        ],
      },
      files: {
        'solo.md': {
          frontMatter: {},
        },
      },
    }

    const element = new MarkeeSearchFile()
    element.file = 'solo.md'
    element.results = [{ label: 'Only', anchor: '', content: 'Single result' }]
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('button')).toBeNull()
    expect(element.querySelectorAll('[data-markable]')).toHaveLength(2)
  })

  it('uses the singular extra-results label when there is only one additional result', async () => {
    runtimeState.navigation = {
      tree: {
        getAncestorsForKey: () => [
          { key: 'root', label: 'Root', link: '/root' },
          { key: 'solo.md', label: 'Solo', link: '/solo' },
        ],
      },
      files: {
        'solo.md': {
          frontMatter: {},
        },
      },
    }

    const element = new MarkeeSearchFile()
    element.file = 'solo.md'
    element.results = [
      { label: 'Only', anchor: '', content: 'Single result' },
      { label: 'Extra', anchor: '#extra', content: 'Extra result' },
    ]
    document.body.append(element)

    await element.updateComplete

    expect(normalizeText(element.querySelector('button')?.textContent)).toBe(
      'Show 1 more result',
    )
  })
})

describe('MarkeeSearchSection', () => {
  it('renders singular labels without a section name', async () => {
    const element = new MarkeeSearchSection()
    element.results = [{ file: 'guide.md', results: [] }]
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('strong')?.textContent?.trim()).toBe(
      '1 matching document',
    )
  })

  it('renders plural labels with a section name', async () => {
    const element = new MarkeeSearchSection()
    element.sectionName = 'Guides'
    element.search = 'guide'
    element.results = [
      { file: 'guide-a.md', results: [] },
      { file: 'guide-b.md', results: [] },
    ]
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('strong')?.textContent?.trim()).toBe(
      '2 matching documents in Guides',
    )
    expect(element.querySelectorAll('markee-search-file')).toHaveLength(2)
  })
})

describe('MarkeeSearch', () => {
  it('normalizes shard values and strategies', () => {
    expect(MarkeeSearch.getShardValue('^docs$')).toBe('docs')
    expect(MarkeeSearch.getShardValue('^docs')).toBe('docs')
    expect(MarkeeSearch.getShardValue('docs$')).toBe('docs')
    expect(MarkeeSearch.getShardValue('docs')).toBe('docs')

    expect(MarkeeSearch.getShardStrategy('^docs$')).toBe('equals')
    expect(MarkeeSearch.getShardStrategy('^docs')).toBe('startsWith')
    expect(MarkeeSearch.getShardStrategy('docs$')).toBe('endsWith')
    expect(MarkeeSearch.getShardStrategy('docs')).toBe('includes')
  })

  it('renders inactive results by default and filters out empty groups', async () => {
    extend.search.groupResults = () => [{ sectionName: 'Empty', results: [] }]
    runtimeState.search = createSearchFn([])

    const element = new MarkeeSearch()
    document.body.append(element)
    await element.updateComplete

    expect(
      element.querySelector('[data-results]')?.hasAttribute('data-active'),
    ).toBe(false)
    expect(
      element.querySelector('[data-backdrop]')?.hasAttribute('data-active'),
    ).toBe(false)
    expect(element.querySelector('input')?.hasAttribute('data-active')).toBe(
      false,
    )
    expect(
      element.querySelector('[data-icon]')?.hasAttribute('data-active'),
    ).toBe(false)
    expect(element.querySelectorAll('markee-search-section')).toHaveLength(0)
  })

  it('parses tag filters, applies shard filters, groups results, and marks the UI active', async () => {
    const results: SearchResult[] = [
      {
        file: 'guide.md',
        results: [{ label: 'Guide', anchor: '#intro', content: 'Guide body' }],
      },
    ]
    const search = createSearchFn(results)
    runtimeState.search = search
    extend.search.getShardingKeys = () => ['^docs$']
    extend.search.groupResults = (grouped) => [
      { sectionName: 'Guides', results: grouped },
    ]

    const element = new MarkeeSearch()
    element.value = `guide tag:"API Docs" tag:'beta' tag:go`
    document.body.append(element)
    await element.updateComplete

    expect(search).toHaveBeenCalledWith('guide', {
      filters: [
        { kind: 'anyOf', field: 'key', values: ['docs'], strategy: 'equals' },
        {
          kind: 'allOf',
          field: 'tags',
          values: ['API Docs', 'beta', 'go'],
          strategy: 'equals',
        },
      ],
    })
    expect(search.anyOf).toHaveBeenCalled()
    expect(search.allOf).toHaveBeenCalled()
    expect(
      element.querySelector('[data-results]')?.hasAttribute('data-active'),
    ).toBe(true)
    expect(element.querySelector('markee-search-section')).not.toBeNull()
    expect(
      (element.querySelector('markee-search-section') as MarkeeSearchSection)
        .search,
    ).toBe('guide API Docs beta go')
  })

  it('falls back to searching with tag text when no free-text query remains', async () => {
    const search = createSearchFn()
    runtimeState.search = search

    const element = new MarkeeSearch()
    element.value = `tag:"API Docs" tag:go`
    document.body.append(element)
    await element.updateComplete

    expect(search).toHaveBeenCalledWith('API Docs go')
  })

  it('uses shard filters without tag filters when there are no parsed tags', async () => {
    const search = createSearchFn()
    runtimeState.search = search
    extend.search.getShardingKeys = () => ['docs$']

    const element = new MarkeeSearch()
    element.value = 'guide'
    document.body.append(element)
    await element.updateComplete

    expect(search).toHaveBeenCalledWith('guide', {
      filters: [
        { kind: 'anyOf', field: 'key', values: ['docs'], strategy: 'endsWith' },
      ],
    })
    expect(search.allOf).not.toHaveBeenCalled()
  })

  it('debounces input updates and scrolls results back to the top', async () => {
    vi.useFakeTimers()

    const element = new MarkeeSearch()
    document.body.append(element)
    await element.updateComplete

    const input = element.querySelector('input') as HTMLInputElement
    const results = element.querySelector(
      '[data-results]',
    ) as HTMLDivElement & {
      scrollTo: ReturnType<typeof vi.fn>
    }
    results.scrollTo = vi.fn()

    input.value = 'debounced'
    input.dispatchEvent(new Event('input'))

    vi.advanceTimersByTime(199)
    expect(element.value).toBe('')

    vi.advanceTimersByTime(1)
    await element.updateComplete
    expect(element.value).toBe('debounced')

    vi.advanceTimersByTime(10)
    expect(results.scrollTo).toHaveBeenCalledWith({ top: 0 })
    vi.useRealTimers()
  })

  it('navigates on Enter when a results page is configured', async () => {
    const element = new MarkeeSearch()
    element.resultsPage = '/search'
    document.body.append(element)
    await element.updateComplete

    const input = element.querySelector('input') as HTMLInputElement
    input.value = 'guide me'
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )

    expect(runtimeState.router.navigate.open).toHaveBeenCalledWith(
      '/search?q=guide%20me',
    )
  })

  it('does not navigate on Enter without a results page and clears on Escape', async () => {
    const element = new MarkeeSearch()
    element.value = 'guide'
    document.body.append(element)
    await element.updateComplete

    const input = element.querySelector('input') as HTMLInputElement
    const blur = vi.spyOn(input, 'blur').mockImplementation(() => {})

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    expect(runtimeState.router.navigate.open).not.toHaveBeenCalled()

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await element.updateComplete

    expect(element.value).toBe('')
    expect(blur).toHaveBeenCalledOnce()
  })

  it('clears on backdrop clicks and result-selection events', async () => {
    const element = new MarkeeSearch()
    element.value = 'guide'
    document.body.append(element)
    await element.updateComplete

    element
      .querySelector('[data-backdrop]')
      ?.dispatchEvent(new MouseEvent('click'))
    await element.updateComplete
    expect(element.value).toBe('')

    element.value = 'guide'
    await element.updateComplete
    element
      .querySelector('[data-results]')
      ?.dispatchEvent(
        new CustomEvent('search-result-selected', { bubbles: true }),
      )
    await element.updateComplete

    expect(element.value).toBe('')
  })
})
