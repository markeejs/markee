import { describe, expect, it } from 'vitest'

import type { BaseDoc, GenericSearchIndexerOptions } from '@markee/search'
import { MarkeeSearchIndexer } from '@markee/search'

type Doc = BaseDoc & {
  title?: string
  body?: string | string[]
  tags?: string[]
  category?: string
  slug?: string
  aliases?: unknown
  titleLow?: string
  titleHigh?: string
  titleDefault?: string
  titleInvalid?: string
  titleNumeric?: string
}

const docs: Doc[] = [
  {
    id: 'a',
    title: 'Café starter',
    body: 'alpha beta gamma',
    tags: [' Guides ', 'Intro'],
    category: 'Guides',
    slug: '  intro/cafe  ',
    aliases: ['Getting Started', 42],
  },
  {
    id: 'b',
    title: 'Starter beta',
    body: ['beta alpha', 'overview'],
    tags: ['Guidebook'],
    category: 'Archive',
    slug: 'intro/beta',
    aliases: ['Beta Docs'],
  },
  {
    id: 'c',
    title: 'Gamma manual',
    body: 'gamma delta',
    tags: ['Reference'],
    category: 'Reference',
    slug: 'manual/gamma',
    aliases: ['Manual'],
  },
  {
    id: 'd',
    title: 'Alphabet soup',
    body: 'alphonse',
    tags: ['Guides'],
    category: 'Guides',
    slug: 'intro/alphabet',
    aliases: ['Alpha Notes'],
  },
]

function createIndexer(
  overrides: Partial<GenericSearchIndexerOptions<Doc>> = {},
  inputDocs = docs,
) {
  return new MarkeeSearchIndexer(inputDocs, {
    textFields: {
      title: { weight: 3, proximityBoost: true, exactMatchBoost: 2 },
      body: { weight: 1, proximityBoost: true },
    },
    prefilterIndexes: {
      tags: { normalize: 'fold' },
      category: { normalize: 'none' },
      slug: { normalize: 'trim', bucketLen: 4 },
    },
    ...overrides,
  })
}

function ids(results: Array<{ id: string }>) {
  return results.map((result) => result.id)
}

describe('MarkeeSearchIndexer', () => {
  describe('constructor', () => {
    it('requires at least one text field', () => {
      expect(
        () =>
          new MarkeeSearchIndexer(docs, {
            textFields: {},
          }),
      ).toThrow(
        'GenericSearchIndexer: options.textFields must be a non-empty record.',
      )

      expect(() => new MarkeeSearchIndexer(docs, undefined as never)).toThrow(
        'GenericSearchIndexer: options.textFields must be a non-empty record.',
      )
    })

    it('ignores falsy text field entries and documents without ids', () => {
      const indexer = new MarkeeSearchIndexer(
        [{ title: 'alpha beta' } as Doc, ...docs],
        {
          textFields: {
            title: { weight: 1, proximityBoost: true },
            body: null as never,
          },
        },
      )

      expect(ids(indexer.search('starter'))).toEqual(['a', 'b'])
    })
  })

  describe('allOf', () => {
    it('matches all normalized needles and exposes prefilter metadata', () => {
      const indexer = createIndexer()
      const filter = indexer.allOf('tags', [' guides ', 'INTRO', 'INTRO'])

      expect(filter(docs[0])).toBe(true)
      expect(filter(docs[1])).toBe(false)
      expect(filter(docs[2])).toBe(false)
      expect(filter.__prefilter).toEqual({
        key: 'tags',
        mode: 'equals',
        needles: ['guides', 'intro'],
        normalize: 'fold',
        op: 'allOf',
      })
    })

    it('supports startsWith matching for arrays and missing values', () => {
      const indexer = createIndexer()
      const filter = indexer.allOf('aliases', ['get'], 'startsWith')

      expect(filter(docs[0])).toBe(true)
      expect(filter(docs[1])).toBe(false)
      expect(filter({ id: 'x' } as Doc)).toBe(false)
    })

    it('supports exact matching without normalization', () => {
      const indexer = createIndexer()
      const filter = indexer.allOf('slug', ['  intro/cafe  '], 'equals', 'none')

      expect(filter(docs[0])).toBe(true)
      expect(filter(docs[1])).toBe(false)
    })
  })

  describe('anyOf', () => {
    it('supports endsWith and includes modes', () => {
      const indexer = createIndexer()
      const endsWith = indexer.anyOf('slug', ['beta'], 'endsWith', 'trim')
      const includes = indexer.anyOf('title', ['pha'], 'includes')

      expect(endsWith(docs[1])).toBe(true)
      expect(endsWith(docs[0])).toBe(false)
      expect(includes(docs[0])).toBe(false)
      expect(includes(docs[3])).toBe(true)
    })

    it('returns false when the field is not string-like', () => {
      const indexer = createIndexer()
      const filter = indexer.anyOf('aliases', ['manual'])

      expect(filter(docs[0])).toBe(false)
      expect(filter(docs[2])).toBe(true)
      expect(filter({ id: 'x', aliases: 12 } as Doc)).toBe(false)
    })
  })

  describe('search', () => {
    it('returns no results for an empty query unless filter-only mode is enabled', () => {
      const indexer = createIndexer()

      expect(indexer.search('')).toEqual([])
      expect(indexer.search('   ', { filters: [] })).toEqual([])
    })

    it('supports filter-only mode, sorts by id, and respects limit', () => {
      const indexer = createIndexer()
      const results = indexer.search('   ', {
        allowEmptyQueryWithFilters: true,
        filters: [
          indexer.anyOf('category', ['Guides'], undefined, 'none'),
          indexer.anyOf('slug', ['intro/'], 'startsWith', 'trim'),
        ],
        limit: 1,
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ id: 'a', score: 0 })
    })

    it('ignores missing prefilter indices and falsy prefilter configs', () => {
      const indexer = createIndexer({
        prefilterIndexes: {
          tags: { normalize: 'fold' },
          aliases: null as never,
        },
      })

      const results = indexer.search('manual', {
        filters: [indexer.anyOf('aliases', ['manual'])],
      })

      expect(ids(results)).toEqual(['c'])
    })

    it('falls back to predicate verification for non-accelerated filters', () => {
      const indexer = createIndexer()
      const results = indexer.search('starter', {
        filters: [indexer.anyOf('slug', ['beta'], 'endsWith', 'trim')],
      })

      expect(ids(results)).toEqual(['b'])
    })

    it('returns no results when the prefilter removes all candidates', () => {
      const indexer = createIndexer()
      const results = indexer.search('starter', {
        filters: [indexer.anyOf('tags', ['missing'])],
      })

      expect(results).toEqual([])
    })

    it('returns no results when a later predicate rejects the accelerated set', () => {
      const indexer = createIndexer()
      const results = indexer.search('starter', {
        filters: [
          indexer.anyOf('tags', ['guidebook']),
          (doc: Doc) => doc.category === 'Guides',
        ],
      })

      expect(results).toEqual([])
    })

    it('boosts exact quoted phrases over looser matches', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'exact', title: 'alpha beta', body: 'alpha beta gamma' },
          { id: 'gap', title: 'alpha noise beta', body: 'alpha noise beta' },
          { id: 'reverse', title: 'beta alpha', body: 'beta alpha' },
        ],
        {
          textFields: {
            title: { weight: 2, proximityBoost: true },
            body: { weight: 1, proximityBoost: true },
          },
        },
      )

      expect(ids(indexer.search('"alpha beta"'))).toEqual([
        'exact',
        'gap',
        'reverse',
      ])
    })

    it('boosts in-order terms and prefers broader term coverage by default', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'ordered', title: 'alpha beta', body: 'alpha beta gamma' },
          { id: 'reversed', title: 'beta alpha', body: 'beta alpha gamma' },
          { id: 'partial', title: 'alpha', body: 'alpha only' },
        ],
        {
          textFields: {
            title: { weight: 2, proximityBoost: true },
            body: { weight: 1, proximityBoost: true },
          },
        },
      )

      expect(ids(indexer.search('alpha beta'))).toEqual([
        'ordered',
        'reversed',
        'partial',
      ])
      expect(
        ids(indexer.search('alpha beta', { preferAllTerms: false })),
      ).toEqual(['ordered', 'reversed', 'partial'])
    })

    it('supports exact, short-prefix, and trigram-based fuzzy retrieval', () => {
      const indexer = createIndexer()

      expect(ids(indexer.search('cafe'))).toEqual(['a'])
      expect(ids(indexer.search('al'))).toEqual(['d', 'a', 'b'])
      expect(indexer.search('x')).toEqual([])
      expect(ids(indexer.search('starters'))).toEqual(['a', 'b'])
      expect(indexer.search('zzzz')).toEqual([])
    })

    it('handles mixed quoting and hyphenated term normalization', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'hyphen', title: 'alpha beta', body: 'gamma' },
          { id: 'quoted', title: 'gamma', body: 'delta epsilon' },
        ],
        {
          textFields: {
            title: { weight: 2, proximityBoost: true },
            body: { weight: 1, proximityBoost: true },
          },
        },
      )

      expect(ids(indexer.search(`alpha-beta "delta epsilon"`))).toEqual([
        'hyphen',
        'quoted',
      ])
    })

    it('skips overly long tokens in both the index and the query', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          {
            id: 'short',
            title: 'brief alpha',
            body: 'small',
          },
          {
            id: 'long',
            title: 'supercalifragilisticexpialidocious',
            body: 'supercalifragilisticexpialidocious',
          },
        ],
        {
          maxTokenLength: 5,
          textFields: {
            title: { weight: 1, proximityBoost: true },
            body: { weight: 1, proximityBoost: true },
          },
        },
      )

      expect(ids(indexer.search('brief'))).toEqual(['short'])
      expect(
        ids(indexer.search('brief supercalifragilisticexpialidocious')),
      ).toEqual(['short'])
      expect(indexer.search('supercalifragilisticexpialidocious')).toEqual([])
    })

    it('handles repeated query terms and missing text field values', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'full', title: 'alpha beta', body: 'alpha beta' },
          { id: 'missing', title: 'alpha beta' },
        ],
        {
          textFields: {
            title: { weight: 2, proximityBoost: true },
            body: { weight: 1, proximityBoost: true },
          },
        },
      )

      expect(ids(indexer.search(`alpha "alpha beta"`))).toEqual([
        'full',
        'missing',
      ])
    })

    it('skips phrase and order boosts when there are no cached positions', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'ordered', title: 'alpha beta', body: 'alpha beta' },
          { id: 'other', title: 'beta gamma', body: 'beta gamma' },
        ],
        {
          textFields: {
            title: { weight: 2 },
            body: { weight: 1, proximityBoost: true },
          },
        },
      )

      expect(ids(indexer.search('"alpha beta"'))).toEqual(['ordered', 'other'])
      expect(ids(indexer.search('alpha beta'))).toEqual(['ordered', 'other'])
    })

    it('skips boost work entirely when no field stores positions', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'ordered', title: 'alpha beta', body: 'alpha beta' },
          { id: 'other', title: 'beta gamma', body: 'beta gamma' },
        ],
        {
          textFields: {
            title: { weight: 2 },
            body: { weight: 1 },
          },
        },
      )

      expect(ids(indexer.search('"alpha beta"'))).toEqual(['ordered', 'other'])
      expect(ids(indexer.search('alpha beta'))).toEqual(['ordered', 'other'])
    })

    it('covers short-prefix and trigram fuzzy rejection branches', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          { id: 'alpha', title: 'alpha' },
          { id: 'alpine', title: 'alpine' },
        ],
        {
          textFields: {
            title: { weight: 1 },
          },
        },
      )
      const getTermCandidates = (
        indexer as unknown as {
          getTermCandidates(
            queryTerm: string,
            fuzzyMaxCandidates: number,
          ): Array<{ term: string; weight: number }>
        }
      ).getTermCandidates.bind(indexer)

      expect(getTermCandidates('xy', 8)).toEqual([])
      expect(getTermCandidates('alzzz', 8)).toEqual([])
      expect(getTermCandidates('alphqqqqqq', 8)).toEqual([])
    })

    it('uses friendly bm25 option branches and clamps invalid numeric values', () => {
      const indexer = new MarkeeSearchIndexer(
        [
          {
            id: 'doc',
            titleLow: 'alpha',
            titleHigh: 'alpha',
            titleDefault: 'alpha',
            titleInvalid: 'alpha',
            titleNumeric: 'alpha',
          },
        ],
        {
          textFields: {
            titleLow: {
              weight: 1,
              frequencySaturation: 'low',
              lengthNormalization: 'none',
            },
            titleHigh: {
              weight: 1,
              frequencySaturation: 'high',
              lengthNormalization: 'strong',
            },
            titleDefault: {
              weight: 1,
            },
            titleInvalid: {
              weight: 1,
              frequencySaturation: Number.NaN,
              lengthNormalization: -1,
              expectedLength: 0,
            },
            titleNumeric: {
              weight: 1,
              frequencySaturation: 2.2,
              lengthNormalization: 2,
              expectedLength: 10,
            },
          },
        },
      )

      expect(ids(indexer.search('alpha'))).toEqual(['doc'])
    })

    it('supports filter-only searches with empty normalized needles', () => {
      const indexer = createIndexer()
      const results = indexer.search(' ', {
        allowEmptyQueryWithFilters: true,
        filters: [indexer.allOf('tags', ['   '])],
      })

      expect(ids(results)).toEqual(['a', 'b', 'c', 'd'])
    })
  })
})
