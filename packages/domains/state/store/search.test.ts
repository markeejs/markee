import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@markee/pipeline', () => ({
  searchPipeline: vi.fn((content: string) => `html:${content}`),
  clientPipeline: vi.fn(),
}))

import { searchPipeline } from '@markee/pipeline'

import { $navigationLoader, $searchLoader } from './metadata.js'
import { $search } from './search.js'

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
  $navigationLoader.set({
    loading: false,
    data: { files: {}, folders: {}, assets: {} },
    error: null,
  })
  $searchLoader.set({ loading: false, data: null, error: null })
})

describe('$search', () => {
  it('returns an empty search function when either loader is missing', () => {
    expect($search.get()('query')).toEqual([])
  })

  it('builds grouped results from the search index and exposes filter helpers', () => {
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

    const search = $search.get()
    const results = search('alpha')

    expect(results.map((result: (typeof results)[number]) => result.file)).toEqual([
      'guide.md',
      'other.md',
    ])
    expect(results[0]?.results).toEqual([
      { label: 'Intro', anchor: 'intro', content: 'html:Alpha beta' },
      { label: 'API', anchor: 'api', content: 'html:Alpha gamma' },
    ])
    expect(searchPipeline).toHaveBeenCalledWith('Alpha beta')
    expect(typeof search.anyOf).toBe('function')
    expect(typeof search.allOf).toBe('function')
  })
})
