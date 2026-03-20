import { describe, expect, it } from 'vitest'

import type { BaseDoc, PrefilterDescriptor } from './index.js'
import type { PrefilterIndex } from './internal.js'
import {
  bm25Idf,
  bm25Score,
  clamp01,
  defaultBucketLen,
  deriveSetForDescriptor,
  firstGreaterThan,
  foldText,
  fuzzyWeight,
  getTrigrams,
  intersectAllSets,
  intersectSets,
  isSpace,
  jaccard,
  levenshteinBounded,
  makeMatcher,
  maxEditDistance,
  minOrderedSpan,
  normalizeNeedleArray,
  normalizeQueryToken,
  normalizeText,
  normalizeValue,
  parseQuery,
  passesAllFilters,
  prefilterMapKey,
  proximityFactor,
  readStringField,
  resolveBm25,
  tokenize,
} from './internal.js'

type Doc = BaseDoc & {
  title?: string
  tags?: string[]
  misc?: unknown
}

function createIndex(
  valuesByDoc: Record<string, string[]>,
  bucketLen = 2,
): PrefilterIndex {
  const eq = new Map<string, Set<string>>()
  const prefixBuckets = new Map<string, Set<string>>()

  for (const [docId, values] of Object.entries(valuesByDoc)) {
    for (const value of values) {
      let equalDocs = eq.get(value)
      if (!equalDocs) eq.set(value, (equalDocs = new Set()))
      equalDocs.add(docId)

      const bucket = value.slice(0, Math.min(bucketLen, value.length))
      let bucketDocs = prefixBuckets.get(bucket)
      if (!bucketDocs) prefixBuckets.set(bucket, (bucketDocs = new Set()))
      bucketDocs.add(docId)
    }
  }

  return {
    key: 'slug',
    normalize: 'trim',
    eq,
    prefixBuckets,
    valuesByDoc: new Map(Object.entries(valuesByDoc)),
    bucketLen,
  }
}

describe('search internals', () => {
  describe('resolveBm25', () => {
    it('maps friendly knobs and clamps invalid numeric values', () => {
      expect(
        resolveBm25(
          {
            weight: 1,
            frequencySaturation: 'low',
            lengthNormalization: 'none',
          },
          12,
          1.2,
          0.75,
        ),
      ).toEqual({ k1: 0.6, b: 0, avgLenHint: 12 })

      expect(
        resolveBm25(
          {
            weight: 1,
            frequencySaturation: 'high',
            lengthNormalization: 'strong',
            expectedLength: 20,
          },
          12,
          1.2,
          0.75,
        ),
      ).toEqual({ k1: 1.8, b: 0.9, avgLenHint: 20 })

      expect(
        resolveBm25(
          {
            weight: 1,
            frequencySaturation: Number.NaN,
            lengthNormalization: -1,
            expectedLength: 0,
          },
          12,
          1.2,
          0.75,
        ),
      ).toEqual({ k1: 1.2, b: 0, avgLenHint: 12 })

      expect(
        resolveBm25(
          {
            weight: 1,
            lengthNormalization: Number.NaN,
          },
          12,
          1.2,
          0.75,
        ),
      ).toEqual({ k1: 1.2, b: 0.75, avgLenHint: 12 })

      expect(
        resolveBm25(
          {
            weight: 1,
            frequencySaturation: 2.5,
            lengthNormalization: 2,
            expectedLength: -5,
          },
          12,
          1.2,
          0.75,
        ),
      ).toEqual({ k1: 2.5, b: 1, avgLenHint: 12 })

      expect(
        resolveBm25(
          {
            weight: 1,
            lengthNormalization: 'light',
          },
          12,
          1.2,
          0.75,
        ),
      ).toEqual({ k1: 1.2, b: 0.2, avgLenHint: 12 })
    })
  })

  describe('deriveSetForDescriptor', () => {
    it('handles equals anyOf, allOf, and empty needles', () => {
      const index = createIndex({
        a: ['intro/cafe'],
        b: ['intro/beta'],
        c: ['manual/gamma'],
      })

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: [],
          mode: 'equals',
          op: 'anyOf',
        }),
      ).toBeNull()

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['intro/cafe', 'manual/gamma'],
          mode: 'equals',
          op: 'anyOf',
        }),
      ).toEqual(new Set(['a', 'c']))

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['intro/cafe', 'intro/cafe'],
          mode: 'equals',
          op: 'allOf',
        }),
      ).toEqual(new Set(['a']))

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['missing'],
          mode: 'equals',
          op: 'allOf',
        }),
      ).toEqual(new Set())

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['missing'],
          mode: 'equals',
          op: 'anyOf',
        }),
      ).toEqual(new Set())
    })

    it('handles startsWith matches, collisions, and unsupported modes', () => {
      const index = createIndex(
        {
          a: ['abx-1', 'abz-1'],
          b: ['abc-2'],
          c: ['abd-3'],
        },
        2,
      )

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['abc'],
          mode: 'startsWith',
          op: 'anyOf',
        }),
      ).toEqual(new Set(['b']))

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['abe'],
          mode: 'startsWith',
          op: 'anyOf',
        }),
      ).toEqual(new Set())

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['abe'],
          mode: 'startsWith',
          op: 'allOf',
        }),
      ).toEqual(new Set())

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['zzz'],
          mode: 'startsWith',
          op: 'anyOf',
        }),
      ).toEqual(new Set())

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['zzz'],
          mode: 'startsWith',
          op: 'allOf',
        }),
      ).toEqual(new Set())

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['abc', 'abd'],
          mode: 'startsWith',
          op: 'allOf',
        }),
      ).toEqual(new Set())

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['ab', 'abc'],
          mode: 'startsWith',
          op: 'allOf',
        }),
      ).toEqual(new Set(['b']))

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['abc', 'abd'],
          mode: 'startsWith',
          op: 'anyOf',
        }),
      ).toEqual(new Set(['b', 'c']))

      expect(
        deriveSetForDescriptor(index, {
          key: 'slug',
          normalize: 'trim',
          needles: ['abc'],
          mode: 'includes',
          op: 'anyOf',
        } satisfies PrefilterDescriptor),
      ).toBeNull()
    })
  })

  describe('set helpers', () => {
    it('computes map keys, default buckets, filter predicates, and intersections', () => {
      expect(prefilterMapKey('slug', 'trim')).toBe('slug|trim')
      expect(defaultBucketLen('fold')).toBe(3)
      expect(defaultBucketLen('none')).toBe(2)

      expect(
        passesAllFilters(
          { id: 'a', title: 'ok' },
          [(doc) => doc.id === 'a', (doc) => doc.title === 'ok'],
        ),
      ).toBe(true)
      expect(
        passesAllFilters(
          { id: 'a', title: 'ok' },
          [(doc) => doc.id === 'a', () => false],
        ),
      ).toBe(false)

      expect(intersectSets(new Set(['a', 'b']), new Set(['b', 'c']))).toEqual(
        new Set(['b']),
      )
      expect(
        intersectAllSets([
          new Set(['a', 'b', 'c']),
          new Set(['b', 'c']),
          new Set(['c']),
        ]),
      ).toEqual(new Set(['c']))
      expect(
        intersectAllSets([new Set(['a']), new Set(['b']), new Set(['c'])]),
      ).toEqual(new Set())
    })
  })

  describe('query parsing', () => {
    it('parses mixed whitespace and quoted phrases', () => {
      expect(parseQuery(`  alpha  "beta gamma" 'delta' zeta`)).toEqual([
        { kind: 'term', raw: 'alpha' },
        { kind: 'phrase', raw: 'beta gamma' },
        { kind: 'phrase', raw: 'delta' },
        { kind: 'term', raw: 'zeta' },
      ])

      expect(parseQuery('"unterminated phrase')).toEqual([
        { kind: 'phrase', raw: 'unterminated phrase' },
      ])
      expect(parseQuery('alpha   ')).toEqual([{ kind: 'term', raw: 'alpha' }])
      expect(parseQuery('')).toEqual([])

      expect(isSpace(' ')).toBe(true)
      expect(isSpace('\t')).toBe(true)
      expect(isSpace('\n')).toBe(true)
      expect(isSpace('\r')).toBe(true)
      expect(isSpace('\f')).toBe(true)
      expect(isSpace('x')).toBe(false)
    })

    it('normalizes query tokens into terms or phrases', () => {
      expect(
        normalizeQueryToken({ kind: 'term', raw: 'Café' }, 20),
      ).toEqual({
        kind: 'term',
        raw: 'Café',
        needle: 'cafe',
        term: 'cafe',
      })

      expect(
        normalizeQueryToken({ kind: 'term', raw: 'alpha-beta' }, 20),
      ).toEqual({
        kind: 'phrase',
        raw: 'alpha-beta',
        needle: 'alpha-beta',
        terms: ['alpha', 'beta'],
      })

      expect(
        normalizeQueryToken({ kind: 'phrase', raw: 'alpha beta' }, 20),
      ).toEqual({
        kind: 'phrase',
        raw: 'alpha beta',
        needle: 'alpha beta',
        terms: ['alpha', 'beta'],
      })

      expect(
        normalizeQueryToken({ kind: 'term', raw: 'superlongtoken' }, 5),
      ).toEqual({
        kind: 'term',
        raw: 'superlongtoken',
        needle: 'superlongtoken',
        term: '',
      })
    })
  })

  describe('normalization helpers', () => {
    it('folds text, tokenizes, normalizes values, and reads string fields', () => {
      expect(foldText("Café ’Tick`")).toBe("cafe 'tick'")
      expect(normalizeText('École')).toBe('ecole')
      expect(tokenize('alpha beta superlongtoken', 5)).toEqual(['alpha', 'beta'])
      expect(tokenize('', 5)).toEqual([])

      expect(normalizeValue('  Café  ', 'fold')).toBe('cafe')
      expect(normalizeValue('  Café  ', 'trim')).toBe('Café')
      expect(normalizeValue('  Café  ', 'none')).toBe('  Café  ')
      expect(normalizeValue(undefined as never, 'none')).toBe('')

      expect(normalizeNeedleArray(['  Café  ', 'cafe', '   '], 'fold')).toEqual([
        'cafe',
      ])
      expect(normalizeNeedleArray(undefined as never, 'fold')).toEqual([])

      const equals = makeMatcher()
      const startsWith = makeMatcher('startsWith')
      const endsWith = makeMatcher('endsWith')
      const includes = makeMatcher('includes')

      expect(equals('alpha', 'alpha')).toBe(true)
      expect(startsWith('alpha', 'al')).toBe(true)
      expect(endsWith('alpha', 'ha')).toBe(true)
      expect(includes('alpha', 'lp')).toBe(true)

      const doc: Doc = {
        id: 'a',
        title: ' Café ',
        tags: [' Guides ', 'Intro', 42 as never],
        misc: 12,
      }

      expect(readStringField(doc, 'title', 'fold')).toEqual(['cafe'])
      expect(readStringField({ id: 'b', title: '   ' }, 'title', 'trim')).toEqual(
        [],
      )
      expect(readStringField(doc, 'tags', 'trim')).toEqual(['Guides', 'Intro'])
      expect(readStringField(doc, 'misc', 'fold')).toEqual([])
    })
  })

  describe('scoring helpers', () => {
    it('computes bm25, spans, proximity, trigrams, and fuzzy weights', () => {
      expect(bm25Idf(10, 2)).toBeGreaterThan(0)
      expect(bm25Score(2, 10, 8, 1, 1.2, 0.75)).toBeGreaterThan(0)

      expect(minOrderedSpan([])).toBe(Infinity)
      expect(minOrderedSpan([[0], [1], [2]])).toBe(2)
      expect(minOrderedSpan([[5], [2]])).toBe(Infinity)
      expect(minOrderedSpan([[0, 4], [3, 6]])).toBe(2)

      expect(firstGreaterThan([1, 3, 5], 3)).toBe(5)
      expect(firstGreaterThan([1, 3, 5], 5)).toBeNull()

      expect(proximityFactor(0, 10)).toBe(1)
      expect(proximityFactor(10, 10)).toBe(0)
      expect(proximityFactor(5, 10)).toBe(0.5)

      expect(getTrigrams('')).toEqual([])
      expect(getTrigrams('ab')).toEqual(['^ab', 'ab$'])

      expect(maxEditDistance(4)).toBe(1)
      expect(maxEditDistance(6)).toBe(2)
      expect(maxEditDistance(8)).toBe(3)

      expect(jaccard(new Set(['abc']), [])).toBe(0)
      expect(jaccard(new Set(['abc', 'bcd']), ['abc', 'cde'])).toBe(1 / 3)

      expect(fuzzyWeight(1, 5, 0.8)).toBeGreaterThan(0)
      expect(clamp01(-1)).toBe(0)
      expect(clamp01(2)).toBe(1)
      expect(clamp01(0.4)).toBe(0.4)
    })

    it('computes bounded levenshtein distances and early exits', () => {
      expect(levenshteinBounded('alpha', 'alpha', 0)).toBe(0)
      expect(levenshteinBounded('alphabet', 'ab', 2)).toBe(Infinity)
      expect(levenshteinBounded('beta', 'zeta', 1)).toBe(1)
      expect(levenshteinBounded('abcd', 'wxyz', 1)).toBe(Infinity)
      expect(levenshteinBounded('abcd', 'abc', 1)).toBe(1)
    })
  })
})
