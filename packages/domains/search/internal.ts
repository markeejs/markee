import type {
  FilterableDoc,
  IndexedFilter,
  NormalizeMode,
  PrefilterDescriptor,
  StringMatchMode,
  TextFieldOptions,
} from './index.js'

/** Parsed query token (pre-normalization). */
export type ParsedQueryToken =
  | { kind: 'term'; raw: string }
  | { kind: 'phrase'; raw: string }

/** Normalized query token. */
export type NormalizedQueryToken =
  | { kind: 'term'; raw: string; needle: string; term: string }
  | { kind: 'phrase'; raw: string; needle: string; terms: string[] }

/** Internal prefilter index built from the constructor. */
export interface PrefilterIndex {
  key: string
  normalize: NormalizeMode
  /** Equality inverted index: value -> docs */
  eq: Map<string, Set<string>>
  /** StartsWith acceleration buckets: bucketPrefix -> docs */
  prefixBuckets: Map<string, Set<string>>
  /** For verification: docId -> normalized values */
  valuesByDoc: Map<string, string[]>
  bucketLen: number
}

/**
 * Resolve BM25 parameters for a field using the friendly knobs.
 *
 * @param opts Field options.
 * @param computedAvgLen Average token length computed at indexing time for this field.
 * @param defaultK1 Default BM25 k1.
 * @param defaultB Default BM25 b.
 */
export function resolveBm25(
  opts: TextFieldOptions,
  computedAvgLen: number,
  defaultK1: number,
  defaultB: number,
): { k1: number; b: number; avgLenHint: number } {
  const fs = opts.frequencySaturation ?? 'medium'
  let k1 =
    typeof fs === 'number'
      ? fs
      : fs === 'low'
        ? 0.6
        : fs === 'high'
          ? 1.8
          : defaultK1

  const ln = opts.lengthNormalization ?? 'normal'
  let b =
    typeof ln === 'number'
      ? ln
      : ln === 'none'
        ? 0.0
        : ln === 'light'
          ? 0.2
          : ln === 'strong'
            ? 0.9
            : defaultB

  let avgLenHint = opts.expectedLength ?? computedAvgLen

  if (!Number.isFinite(k1) || k1 <= 0) k1 = defaultK1
  if (!Number.isFinite(b)) b = defaultB
  if (b < 0) b = 0
  if (b > 1) b = 1
  if (!Number.isFinite(avgLenHint) || avgLenHint <= 0)
    avgLenHint = computedAvgLen

  return { k1, b, avgLenHint }
}

export function deriveSetForDescriptor(
  idx: PrefilterIndex,
  d: PrefilterDescriptor,
): Set<string> | null {
  if (d.needles.length === 0) return null

  if (d.mode === 'equals') {
    const sets: Set<string>[] = []
    for (const n of d.needles) {
      const s = idx.eq.get(n)
      if (!s) {
        if (d.op === 'allOf') return new Set()
        continue
      }
      sets.push(s)
    }
    if (sets.length === 0) return new Set()

    if (d.op === 'anyOf') {
      const out = new Set<string>()
      for (const s of sets) for (const id of s) out.add(id)
      return out
    }

    return intersectAllSets(sets)
  }

  if (d.mode === 'startsWith') {
    const perNeedle: Set<string>[] = []

    for (const n of d.needles) {
      const b = n.slice(0, Math.min(idx.bucketLen, n.length))
      const bucketSet = idx.prefixBuckets.get(b)
      if (!bucketSet) {
        if (d.op === 'allOf') return new Set()
        continue
      }

      const verified = new Set<string>()
      for (const docId of bucketSet) {
        const vals = idx.valuesByDoc.get(docId)!
        for (const v of vals) {
          if (v.startsWith(n)) {
            verified.add(docId)
            break
          }
        }
      }

      if (verified.size === 0) {
        if (d.op === 'allOf') return new Set()
        continue
      }

      perNeedle.push(verified)
    }

    if (perNeedle.length === 0) return new Set()

    if (d.op === 'anyOf') {
      const out = new Set<string>()
      for (const s of perNeedle) for (const id of s) out.add(id)
      return out
    }

    perNeedle.sort((a, b) => a.size - b.size)
    let out = perNeedle[0]
    for (let i = 1; i < perNeedle.length; i++) {
      out = intersectSets(out, perNeedle[i])
      if (out.size === 0) break
    }
    return out
  }

  return null
}

export function prefilterMapKey(key: string, normalize: NormalizeMode): string {
  return `${key}|${normalize}`
}

export function defaultBucketLen(normalize: NormalizeMode): number {
  return normalize === 'fold' ? 3 : 2
}

export function passesAllFilters<TDoc>(
  doc: TDoc,
  filters: Array<IndexedFilter<TDoc> | ((doc: TDoc) => boolean)>,
): boolean {
  for (const f of filters) if (!f(doc)) return false
  return true
}

export function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
  if (a.size > b.size) return intersectSets(b, a)
  const out = new Set<string>()
  for (const x of a) if (b.has(x)) out.add(x)
  return out
}

export function intersectAllSets(sets: Set<string>[]): Set<string> {
  sets.sort((a, b) => a.size - b.size)
  let out = sets[0]
  for (let i = 1; i < sets.length; i++) {
    out = intersectSets(out, sets[i])
    if (out.size === 0) break
  }
  return out
}

/**
 * Parse query into tokens; quoted segments become phrase tokens.
 *
 * - Words between single or double quotes become one phrase token.
 * - Non-quoted sequences are split on whitespace into term tokens.
 */
export function parseQuery(input: string): ParsedQueryToken[] {
  const s = input.trim()
  if (!s) return []

  const tokens: ParsedQueryToken[] = []
  let i = 0

  while (i < s.length) {
    while (i < s.length && isSpace(s[i])) i++

    const c = s[i]
    if (c === '"' || c === "'") {
      const quote = c
      i++
      const start = i
      while (i < s.length && s[i] !== quote) i++
      const raw = s.slice(start, i).trim()
      if (raw.length > 0) tokens.push({ kind: 'phrase', raw })
      if (i < s.length && s[i] === quote) i++
      continue
    }

    const start = i
    while (i < s.length && !isSpace(s[i]) && s[i] !== '"' && s[i] !== "'") i++
    const raw = s.slice(start, i)
    if (raw.length > 0) tokens.push({ kind: 'term', raw })
  }

  return tokens
}

export function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f'
}

export function normalizeQueryToken(
  token: ParsedQueryToken,
  maxTokenLength: number,
): NormalizedQueryToken {
  const needle = normalizeText(token.raw).trim()

  if (token.kind === 'term') {
    const terms = tokenize(normalizeText(token.raw), maxTokenLength)
    if (terms.length <= 1)
      return { kind: 'term', raw: token.raw, needle, term: terms[0] ?? '' }
    return { kind: 'phrase', raw: token.raw, needle, terms }
  }

  const terms = tokenize(normalizeText(token.raw), maxTokenLength)
  return { kind: 'phrase', raw: token.raw, needle, terms }
}

/** Diacritics-folded lowercasing. */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
}

/** Normalize text used in the search index (folded). */
export function normalizeText(text: string): string {
  return foldText(text)
}

/** Tokenize normalized text into alphanumeric word tokens. */
export function tokenize(
  normalizedText: string,
  maxTokenLength: number,
): string[] {
  const out: string[] = []
  const re = /[\p{L}\p{N}]+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(normalizedText))) {
    const t = m[0]
    if (t.length > maxTokenLength) continue
    out.push(t)
  }
  return out
}

export function normalizeValue(v: string, mode: NormalizeMode): string {
  const s = String(v ?? '')
  if (mode === 'none') return s
  if (mode === 'trim') return s.trim()
  return foldText(s).trim()
}

export function normalizeNeedleArray(
  arr: string[],
  mode: NormalizeMode,
): string[] {
  const out: string[] = []
  for (const x of arr ?? []) {
    const v = normalizeValue(x, mode)
    if (v) out.push(v)
  }
  return Array.from(new Set(out))
}

export function makeMatcher(
  mode?: StringMatchMode,
): (value: string, needle: string) => boolean {
  if (!mode) return (value, needle) => value === needle
  if (mode === 'startsWith') return (value, needle) => value.startsWith(needle)
  if (mode === 'endsWith') return (value, needle) => value.endsWith(needle)
  return (value, needle) => value.includes(needle)
}

/**
 * Read a field from a document as a normalized string array.
 *
 * If the field is missing or not a string/string[], returns [].
 */
export function readStringField<TDoc extends FilterableDoc>(
  doc: TDoc,
  key: keyof TDoc & string,
  normalize: NormalizeMode,
): string[] {
  const raw = doc[key] as unknown
  if (typeof raw === 'string') {
    const v = normalizeValue(raw, normalize)
    return v ? [v] : []
  }
  if (Array.isArray(raw)) {
    const out: string[] = []
    for (const x of raw) {
      if (typeof x !== 'string') continue
      const v = normalizeValue(x, normalize)
      if (v) out.push(v)
    }
    return out
  }
  return []
}

export function bm25Idf(N: number, df: number): number {
  return Math.log(1 + (N - df + 0.5) / (df + 0.5))
}

export function bm25Score(
  tf: number,
  dl: number,
  avgdl: number,
  idf: number,
  k1: number,
  b: number,
): number {
  const denom = tf + k1 * (1 - b + b * (dl / Math.max(1, avgdl)))
  return idf * ((tf * (k1 + 1)) / denom)
}

/**
 * Minimum span length when choosing one increasing position from each list.
 * Returns Infinity if no increasing chain exists.
 */
export function minOrderedSpan(posLists: number[][]): number {
  const first = posLists[0]
  if (!first || first.length === 0) return Infinity

  let best = Infinity
  for (let i = 0; i < first.length; i++) {
    const start = first[i]
    let last = start
    let ok = true

    for (let j = 1; j < posLists.length; j++) {
      const lst = posLists[j]
      const nxt = firstGreaterThan(lst, last)
      if (nxt === null) {
        ok = false
        break
      }
      last = nxt
    }
    if (!ok) continue

    const span = last - start
    if (span < best) best = span
    if (best === posLists.length - 1) return best
  }
  return best
}

export function firstGreaterThan(arr: number[], x: number): number | null {
  let lo = 0
  let hi = arr.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] > x) {
      ans = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  return ans === -1 ? null : arr[ans]
}

export function proximityFactor(span: number, window: number): number {
  if (span <= 0) return 1
  if (span >= window) return 0
  return 1 - span / window
}

export function getTrigrams(s: string): string[] {
  const x = `^${s}$`
  const tris: string[] = []
  for (let i = 0; i + 3 <= x.length; i++) tris.push(x.slice(i, i + 3))
  return tris
}

export function maxEditDistance(len: number): number {
  if (len <= 4) return 1
  if (len <= 7) return 2
  return 3
}

export function jaccard(qSet: Set<string>, tTris: string[]): number {
  if (tTris.length === 0) return 0
  let inter = 0
  const tSet = new Set(tTris)
  for (const tri of qSet) if (tSet.has(tri)) inter++
  const union = qSet.size + tSet.size - inter
  return inter / union
}

export function fuzzyWeight(dist: number, qLen: number, j: number): number {
  const d = dist / Math.max(1, qLen)
  const base = 0.55 + 0.45 * j
  const penalty = Math.min(0.35, d * 0.9)
  return clamp01(base - penalty)
}

export function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

/**
 * Bounded Levenshtein distance with early exit:
 * returns Infinity if distance exceeds maxDist.
 */
export function levenshteinBounded(
  a: string,
  b: string,
  maxDist: number,
): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (Math.abs(al - bl) > maxDist) return Infinity
  if (al > bl) return levenshteinBounded(b, a, maxDist)

  const prev = new Uint16Array(bl + 1)
  const curr = new Uint16Array(bl + 1)

  for (let j = 0; j <= bl; j++) prev[j] = j as unknown as number

  for (let i = 1; i <= al; i++) {
    curr[0] = i as unknown as number
    let rowMin = curr[0]

    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= bl; j++) {
      const cb = b.charCodeAt(j - 1)
      const cost = ca === cb ? 0 : 1

      const del = (prev[j] + 1) as number
      const ins = (curr[j - 1] + 1) as number
      const sub = (prev[j - 1] + cost) as number

      let v = del
      if (ins < v) v = ins
      if (sub < v) v = sub

      curr[j] = v as unknown as number
      if (v < rowMin) rowMin = v
    }

    if (rowMin > maxDist) return Infinity
    for (let j = 0; j <= bl; j++) prev[j] = curr[j]
  }

  const d = prev[bl]
  return d
}
