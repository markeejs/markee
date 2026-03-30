import type { MarkdownFile } from '@markee/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function markdownFile(title: string, tags: string[] = []) {
  return {
    link: `/${title.toLowerCase()}`,
    layout: 'docs',
    frontMatter: {
      title,
      tags,
      excerpt: '',
    },
    readingTime: 0,
    payload: {},
  } as MarkdownFile
}

beforeEach(() => {
  vi.resetModules()
})

describe('$search', () => {
  async function importSearchState() {
    const searchPipeline = vi.fn((content: string) => `html:${content}`)
    const anyOf = vi.fn()
    const allOf = vi.fn()

    vi.doMock('@markee/pipeline/pipelines/search.js', () => ({
      searchPipeline,
    }))
    vi.doMock('@markee/search', () => ({
      MarkeeSearchIndexer: class MarkeeSearchIndexer<
        T extends Record<string, any>,
      > {
        dataset: T[]

        anyOf = anyOf

        allOf = allOf

        constructor(dataset: T[]) {
          this.dataset = dataset
        }

        search(query: string) {
          return this.dataset
            .filter((doc) =>
              [doc.key, doc.title, doc.label, doc.content, ...(doc.tags ?? [])]
                .filter(Boolean)
                .some((value) => String(value).includes(query)),
            )
            .map((doc) => ({ doc }))
        }
      },
    }))

    const metadata = await import('./metadata.js')
    const search = await import('./search.js')

    metadata.$navigationLoader.set({
      loading: false,
      data: { files: {}, folders: {}, assets: {} },
      error: null,
    })
    metadata.$searchLoader.set({ loading: false, data: null, error: null })

    return {
      ...metadata,
      ...search,
      searchPipeline,
      anyOf,
      allOf,
    }
  }

  it('returns an empty search function for empty queries and when loaders are missing', async () => {
    const { $search, $searchLoader } = await importSearchState()
    const unlisten = $search.listen(() => {})

    try {
      const bootstrapSearch = $search.get()

      expect(bootstrapSearch('')).toEqual([])
      expect(bootstrapSearch('query')).toEqual([])

      $searchLoader.set({ loading: false, data: null, error: null })

      await vi.waitFor(() => {
        expect($search.get()).not.toBe(bootstrapSearch)
      })

      expect($search.get()('query')).toEqual([])
    } finally {
      unlisten()
    }
  })

  it('builds grouped results from the search index and exposes filter helpers', async () => {
    const { $navigationLoader, $searchLoader, $search, searchPipeline } =
      await importSearchState()
    const unlisten = $search.listen(() => {})

    try {
      $navigationLoader.set({
        loading: false,
        data: {
          files: {
            'guide.md': markdownFile('Guide', ['API']),
            'other.md': markdownFile('Other'),
            'empty.md': {
              link: '/empty',
              layout: 'docs',
              frontMatter: {
                excerpt: '',
              },
              readingTime: 0,
              payload: {},
            } as any,
          },
          folders: {},
          assets: {},
        },
        error: null,
      })
      $searchLoader.set({
        loading: false,
        data: {
          'guide.md': {
            intro: { l: 'Intro', c: ['Alpha beta'] },
            api: { l: 'API', c: ['Alpha gamma'] },
          },
          'other.md': {
            start: { l: 'Start', c: ['Alpha only', 'Alpha again'] },
          },
          'empty.md': {
            skip: { l: 'Skip' },
          },
          'missing.md': {
            ignored: { l: 'Ignored', c: ['Alpha missing'] },
          },
        } as any,
        error: null,
      })

      expect($search.get()('alpha')).toEqual([])

      let search = $search.get()
      let results: ReturnType<typeof search> = []

      await vi.waitFor(() => {
        search = $search.get()
        results = search('alpha')

        expect(
          results.map((result: (typeof results)[number]) => result.file),
        ).toEqual(['guide.md', 'other.md'])
      })

      expect(results[0]?.results).toEqual([
        { label: 'Intro', anchor: 'intro', content: 'html:Alpha beta' },
        { label: 'API', anchor: 'api', content: 'html:Alpha gamma' },
      ])
      expect(searchPipeline).toHaveBeenCalledWith('Alpha beta')
      expect(typeof search.anyOf).toBe('function')
      expect(typeof search.allOf).toBe('function')
    } finally {
      unlisten()
    }
  })
})
