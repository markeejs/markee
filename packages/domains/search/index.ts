/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Minimal requirement for an indexable document.
 */
export interface BaseDoc {
  /** Unique document identifier. */
  id: string
}

/**
 * Supported string match modes for filters.
 *
 * - Omitted => equality (===) after normalization
 * - "startsWith" | "endsWith" | "includes" => uses the corresponding string method after normalization
 */
export type StringMatchMode = 'startsWith' | 'endsWith' | 'includes' | 'equals'

/**
 * Normalization modes for filters and prefilter indices.
 *
 * - "fold": lowercase + diacritics fold + trim
 * - "trim": trim only
 * - "none": no normalization
 */
export type NormalizeMode = 'fold' | 'trim' | 'none'

/**
 * A document shape that supports arbitrary fields.
 * Fields used by `textFields`, `filters`, and `prefilterIndexes` must be `string | string[]` at runtime.
 */
export type FilterableDoc = BaseDoc & Record<string, any>

/**
 * A prefilter descriptor attached to a predicate.
 *
 * The indexer may use this descriptor to narrow candidates before running predicates.
 * Predicates remain the source of truth; prefiltering is an optimization only.
 */
export type PrefilterDescriptor = {
  /** Document field key (must exist on the document). */
  key: string
  /** "allOf" = AND across needles; "anyOf" = OR across needles. */
  op: 'allOf' | 'anyOf'
  /** Match mode. "eq" means equality. */
  mode: StringMatchMode
  /** Needles normalized according to `normalize`. */
  needles: string[]
  /** Normalization used for both doc values and needles. */
  normalize: NormalizeMode
}

/**
 * A filter predicate that may optionally carry a prefilter descriptor.
 */
export type IndexedFilter<TDoc> = ((doc: TDoc) => boolean) & {
  __prefilter?: PrefilterDescriptor
}

/**
 * Options for a searchable text field (ranking).
 *
 * This indexer uses BM25 under the hood. To avoid exposing the raw BM25 parameter names,
 * the config uses user-friendly knobs, but the JSDoc references the BM25 names:
 *
 * - `frequencySaturation` corresponds to BM25 **k1** (term-frequency saturation).
 * - `lengthNormalization` corresponds to BM25 **b** (length normalization strength, typically 0..1).
 * - `expectedLength` corresponds to the field **avgdl** (average document length) hint for this field.
 *
 * Notes:
 * - `proximityBoost` stores token positions for phrase + in-order boosts.
 */
export interface TextFieldOptions {
  /** Field weight multiplier. Higher means more important (e.g. title > body). */
  weight: number

  /**
   * If true, store token positions for this field to enable:
   * - quoted phrase boosts ("getting started")
   * - in-order boosts (getting started)
   *
   * Memory tradeoff: storing positions increases index size.
   */
  proximityBoost?: boolean

  /**
   * Extra boost when the query token matches exactly (not via fuzzy substitution).
   * Applied once per (doc, queryTerm, field) for the exact candidate.
   */
  exactMatchBoost?: number

  /**
   * Controls BM25 term-frequency saturation (**k1**).
   *
   * Friendly values:
   * - "low"    => k1 ≈ 0.6
   * - "medium" => k1 ≈ 1.2 (default)
   * - "high"   => k1 ≈ 1.8
   *
   * Advanced: supply a number to directly set k1 (must be > 0).
   */
  frequencySaturation?: 'low' | 'medium' | 'high' | number

  /**
   * Controls BM25 length normalization strength (**b**), typically in [0..1].
   *
   * Friendly values:
   * - "none"   => b = 0.0
   * - "light"  => b = 0.2
   * - "normal" => b = 0.75 (default)
   * - "strong" => b = 0.9
   *
   * Advanced: supply a number to directly set b (clamped to [0..1]).
   */
  lengthNormalization?: 'none' | 'light' | 'normal' | 'strong' | number

  /**
   * Optional hint for expected typical token length of this field (BM25 **avgdl**).
   * If omitted, computed from corpus average during indexing.
   */
  expectedLength?: number
}

/**
 * Prefilter index options built at construction time.
 *
 * Notes:
 * - Builds equality inverted index always.
 * - Also builds prefix buckets to accelerate startsWith.
 * - includes/endsWith are not indexed here (still verified by predicates).
 */
export interface PrefilterIndexOptions {
  /** Normalization for values (must match filter normalize). */
  normalize: NormalizeMode
  /**
   * Bucket length used for startsWith acceleration (prefix buckets).
   * If omitted, defaults based on normalize mode.
   */
  bucketLen?: number
}

/**
 * Query-time options for {@link GenericSearchIndexer.search}.
 */
export interface SearchOptions<TDoc extends BaseDoc> {
  /** Maximum number of results to return. Default: 100. */
  limit?: number
  /** Prefer docs matching more unique query terms. Default: true. */
  preferAllTerms?: boolean
  /** Max fuzzy candidates per query term. Default: 48. */
  fuzzyMaxCandidates?: number
  /** Predicate filters. Some may include prefilter metadata. */
  filters?: Array<IndexedFilter<TDoc> | ((doc: TDoc) => boolean)>
  /**
   * If true and query yields no tokens, run filters against all docs and return score=0 results.
   * Default: false.
   */
  allowEmptyQueryWithFilters?: boolean
}

/**
 * Search result.
 */
export interface SearchResult<TDoc extends BaseDoc> {
  /** Document id. */
  id: string
  /** Raw document. */
  doc: TDoc
  /** Final score (higher is better). */
  score: number
}

/**
 * Constructor options for {@link GenericSearchIndexer}.
 */
export interface GenericSearchIndexerOptions<TDoc extends FilterableDoc> {
  /**
   * Searchable text fields (ranking). Required and must be non-empty.
   *
   * Declared as a record to enforce uniqueness by construction:
   * {
   *   title: { weight: 3, proximityBoost: true },
   *   paragraphs: { weight: 1, proximityBoost: true }
   * }
   */
  textFields: Partial<Record<keyof TDoc & string, TextFieldOptions>>

  /**
   * Optional prefilter indices built upfront, keyed by document field name.
   */
  prefilterIndexes?: Partial<Record<keyof TDoc & string, PrefilterIndexOptions>>

  /** Max token length in indexing/query tokenization. Default: 48. */
  maxTokenLength?: number

  /** Cap stored positions per (doc, term, field) to bound memory. Default: 256. */
  maxPositionsPerTermPerDoc?: number
}

/** Posting entry for an indexed term in a specific doc. */
interface DocTermPosting {
  docId: string
  /** Per-field posting: term frequency and optional positions. Keyed by field key string. */
  fields: Map<string, { tf: number; pos?: number[] }>
}

/** Parsed query token (pre-normalization). */
type ParsedQueryToken =
  | { kind: 'term'; raw: string }
  | { kind: 'phrase'; raw: string }

/** Normalized query token. */
type NormalizedQueryToken =
  | { kind: 'term'; raw: string; needle: string; term: string }
  | { kind: 'phrase'; raw: string; needle: string; terms: string[] }

/** Term candidate for retrieval/scoring. */
type TermCandidate = { term: string; weight: number }

/** Internal prefilter index built from the constructor. */
interface PrefilterIndex {
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

/** Internal representation of a text field entry. */
interface InternalTextField {
  key: string
  opts: TextFieldOptions
}

/**
 * Generic, client-side search indexer supporting:
 * - weighted multi-field ranking
 * - fuzzy matching
 * - quoted phrase + in-order boosts
 * - predicate filters with OPTIONAL prebuilt prefilter indices
 */
export class MarkeeSearchIndexer<TDoc extends FilterableDoc> {
  private readonly docs = new Map<string, TDoc>()

  // term -> postings
  private readonly postingsByTerm = new Map<string, DocTermPosting[]>()
  private readonly dfByTerm = new Map<string, number>()
  private readonly vocab = new Set<string>()

  // Fuzzy helpers
  private readonly trigramsByTerm = new Map<string, string[]>()
  private readonly termsByTrigram = new Map<string, string[]>()
  private readonly termsByPrefix2 = new Map<string, string[]>()

  // Field stats + per-doc lengths (keyed by field key string)
  private readonly fieldStats = new Map<
    string,
    { totalLen: number; avgLen: number }
  >()
  private readonly fieldLenByDoc = new Map<string, Map<string, number>>() // docId -> fieldKey -> tokenCount

  // Prefilter indices built upfront: key|normalize -> index
  private readonly prefilters = new Map<string, PrefilterIndex>()

  private readonly textFields: InternalTextField[]
  private readonly maxTokenLength: number
  private readonly maxPositionsPerTermPerDoc: number

  private N = 0

  // Defaults (used when friendly knobs are "medium" / "normal")
  private readonly defaultK1 = 1.2
  private readonly defaultB = 0.75

  // Boosts
  private readonly exactPhraseBoost = 6.0
  private readonly phraseBoost = 2.5
  private readonly inOrderBoost = 1.5

  /**
   * Construct an index for documents.
   *
   * @param docs Documents to index.
   * @param opts Index options (textFields, prefilters, etc.).
   */
  constructor(docs: TDoc[], opts: GenericSearchIndexerOptions<TDoc>) {
    const tf = opts?.textFields ?? {}
    const entries = Object.entries(tf).filter(([, v]) => !!v) as Array<
      [string, TextFieldOptions]
    >

    if (entries.length === 0) {
      throw new Error(
        'GenericSearchIndexer: options.textFields must be a non-empty record.',
      )
    }

    this.textFields = entries.map(([key, options]) => ({ key, opts: options }))
    this.maxTokenLength = opts.maxTokenLength ?? 48
    this.maxPositionsPerTermPerDoc = opts.maxPositionsPerTermPerDoc ?? 256

    this.buildSearchIndex(docs)

    if (opts.prefilterIndexes) {
      this.buildPrefilterIndices(opts.prefilterIndexes)
    }
  }

  /**
   * Convenience filter: all-of match for a document field.
   *
   * doc passes if for EACH needle, there exists at least one field value matching it.
   */
  allOf<K extends keyof TDoc & string>(
    key: K,
    needles: string[],
    mode?: StringMatchMode,
    normalize: NormalizeMode = 'fold',
  ): IndexedFilter<TDoc> {
    const normNeedles = normalizeNeedleArray(needles, normalize)
    const match = makeMatcher(mode)

    const fn = ((doc: TDoc) => {
      const values = readStringField(doc, key, normalize)
      if (values.length === 0) return false

      for (const n of normNeedles) {
        let ok = false
        for (const v of values) {
          if (match(v, n)) {
            ok = true
            break
          }
        }
        if (!ok) return false
      }
      return true
    }) as IndexedFilter<TDoc>

    fn.__prefilter = {
      key,
      op: 'allOf',
      mode: mode ?? 'equals',
      needles: normNeedles,
      normalize,
    }
    return fn
  }

  /**
   * Convenience filter: any-of match for a document field.
   *
   * doc passes if there exists at least one field value matching ANY needle.
   */
  anyOf<K extends keyof TDoc & string>(
    key: K,
    needles: string[],
    mode?: StringMatchMode,
    normalize: NormalizeMode = 'fold',
  ): IndexedFilter<TDoc> {
    const normNeedles = normalizeNeedleArray(needles, normalize)
    const match = makeMatcher(mode)

    const fn = ((doc: TDoc) => {
      const values = readStringField(doc, key, normalize)
      if (values.length === 0) return false

      for (const v of values) {
        for (const n of normNeedles) {
          if (match(v, n)) return true
        }
      }
      return false
    }) as IndexedFilter<TDoc>

    fn.__prefilter = {
      key,
      op: 'anyOf',
      mode: mode ?? 'equals',
      needles: normNeedles,
      normalize,
    }
    return fn
  }

  /**
   * Search the index.
   */
  search(
    query: string,
    options: SearchOptions<TDoc> = {},
  ): SearchResult<TDoc>[] {
    const limit = options.limit ?? 100
    const preferAllTerms = options.preferAllTerms ?? true
    const fuzzyMaxCandidates = options.fuzzyMaxCandidates ?? 48
    const filters = options.filters ?? []
    const allowEmptyQueryWithFilters =
      options.allowEmptyQueryWithFilters ?? false

    const parsed = parseQuery(query)
    const qTokens = parsed
      .map((t) => normalizeQueryToken(t, this.maxTokenLength))
      .filter((t) =>
        t.kind === 'term'
          ? t.term.length > 0 || t.needle.length > 0
          : t.terms.length > 0 || t.needle.length > 0,
      )

    // Filter-only mode
    if (qTokens.length === 0) {
      if (!allowEmptyQueryWithFilters || filters.length === 0) return []

      const preAllowed = this.computePrefilterAllowed(filters)
      const ids = preAllowed ?? new Set(this.docs.keys())

      const out: SearchResult<TDoc>[] = []
      for (const id of ids) {
        const doc = this.docs.get(id)
        if (!doc) continue
        if (passesAllFilters(doc, filters)) out.push({ id, doc, score: 0 })
      }
      out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      return out.slice(0, limit)
    }

    // Ordered terms for in-order boost
    const orderedQueryTerms: string[] = []
    for (const qt of qTokens) {
      if (qt.kind === 'term') {
        if (qt.term) orderedQueryTerms.push(qt.term)
      } else {
        orderedQueryTerms.push(...qt.terms)
      }
    }

    // Unique tokenized terms for coverage
    const uniqueQueryTerms = new Set<string>()
    for (const qt of qTokens) {
      if (qt.kind === 'term') {
        if (qt.term) uniqueQueryTerms.add(qt.term)
      } else {
        qt.terms.forEach((x) => uniqueQueryTerms.add(x))
      }
    }

    // 1) Candidate retrieval
    const candidateDocIds = new Set<string>()
    const termCandidatesCache = new Map<string, TermCandidate[]>()

    for (const qt of qTokens) {
      const terms = qt.kind === 'term' ? (qt.term ? [qt.term] : []) : qt.terms
      for (const t of terms) {
        const cands =
          termCandidatesCache.get(t) ??
          this.getTermCandidates(t, fuzzyMaxCandidates)
        termCandidatesCache.set(t, cands)

        for (const c of cands) {
          const postings = this.postingsByTerm.get(c.term)
          if (!postings) continue
          for (const p of postings) candidateDocIds.add(p.docId)
        }
      }
    }

    if (candidateDocIds.size === 0) return []

    // 2) Prefilter acceleration (if available) + verify predicates
    let allowedCandidates: Set<string> | null = null
    if (filters.length > 0) {
      const preAllowed = this.computePrefilterAllowed(filters)
      allowedCandidates = preAllowed
        ? intersectSets(candidateDocIds, preAllowed)
        : new Set(candidateDocIds)
      if (allowedCandidates.size === 0) return []

      const verified = new Set<string>()
      for (const id of allowedCandidates) {
        const doc = this.docs.get(id)
        if (!doc) continue
        if (passesAllFilters(doc, filters)) verified.add(id)
      }
      allowedCandidates = verified
      if (allowedCandidates.size === 0) return []
    }

    // 3) Score terms over allowedCandidates
    const docScores = new Map<string, number>()
    const docMatchedTerms = new Map<string, Set<string>>()
    const positionsCache = new Map<string, Map<string, Map<string, number[]>>>() // docId -> fieldKey -> term -> positions

    for (const qt of qTokens) {
      const terms = qt.kind === 'term' ? (qt.term ? [qt.term] : []) : qt.terms
      for (const queryTerm of terms) {
        const candidates =
          termCandidatesCache.get(queryTerm) ??
          this.getTermCandidates(queryTerm, fuzzyMaxCandidates)

        for (const cand of candidates) {
          const term = cand.term
          const fuzzyWeightFactor = cand.weight

          const postings = this.postingsByTerm.get(term)
          if (!postings) continue

          const df = this.dfByTerm.get(term) ?? postings.length
          const idf = bm25Idf(this.N, df)

          const isExactCandidate = fuzzyWeightFactor === 1 && term === queryTerm

          for (const p of postings) {
            if (allowedCandidates && !allowedCandidates.has(p.docId)) continue

            let inc = 0
            const dlByField = this.fieldLenByDoc.get(p.docId)

            for (const field of this.textFields) {
              const fieldId = field.key
              const frec = p.fields.get(fieldId)
              if (!frec || frec.tf === 0) continue

              const stat = this.fieldStats.get(fieldId)!
              const { k1, b, avgLenHint } = resolveBm25(
                field.opts,
                stat.avgLen,
                this.defaultK1,
                this.defaultB,
              )

              const dl = dlByField?.get(fieldId) ?? avgLenHint
              inc +=
                bm25Score(frec.tf, dl, avgLenHint, idf, k1, b) *
                field.opts.weight *
                fuzzyWeightFactor

              // Optional exact-match bonus (once per (doc, queryTerm, field) for the exact candidate).
              if (isExactCandidate && field.opts.exactMatchBoost) {
                inc += field.opts.exactMatchBoost * field.opts.weight
              }

              // Cache positions only for exact terms (boost logic references query tokens).
              if (
                field.opts.proximityBoost &&
                isExactCandidate &&
                frec.pos &&
                frec.pos.length > 0
              ) {
                let byField = positionsCache.get(p.docId)
                if (!byField) positionsCache.set(p.docId, (byField = new Map()))
                let byTerm = byField.get(fieldId)
                if (!byTerm) byField.set(fieldId, (byTerm = new Map()))
                byTerm.set(term, frec.pos)
              }
            }

            if (inc !== 0)
              docScores.set(p.docId, (docScores.get(p.docId) ?? 0) + inc)

            let set = docMatchedTerms.get(p.docId)
            if (!set) docMatchedTerms.set(p.docId, (set = new Set()))
            set.add(queryTerm)
          }
        }
      }
    }

    if (docScores.size === 0) return []

    // 4) Coverage multiplier
    const totalUnique = Math.max(1, uniqueQueryTerms.size)
    for (const [docId, base] of docScores) {
      const matched = docMatchedTerms.get(docId)?.size ?? 0
      const coverage = matched / totalUnique
      const covMult = preferAllTerms
        ? 0.75 + 0.85 * coverage + (coverage === 1 ? 0.25 : 0)
        : 0.85 + 0.65 * coverage
      docScores.set(docId, base * covMult)
    }

    // 5) Phrase boosts (quoted)
    for (const qt of qTokens) {
      if (qt.kind !== 'phrase' || qt.terms.length === 0) continue
      this.applyPhraseBoost(qt.terms, docScores, positionsCache)
    }

    // 6) In-order boost (unquoted)
    if (orderedQueryTerms.length >= 2) {
      this.applyInOrderBoost(orderedQueryTerms, docScores, positionsCache)
    }

    // 7) Materialize results
    const results: SearchResult<TDoc>[] = []
    for (const [docId, score] of docScores) {
      if (allowedCandidates && !allowedCandidates.has(docId)) continue
      const doc = this.docs.get(docId)
      if (!doc) continue
      results.push({ id: docId, doc, score })
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  // ----------------------------
  // Prefilter indices (constructor-built)
  // ----------------------------

  private buildPrefilterIndices(
    configs: Partial<Record<keyof TDoc & string, PrefilterIndexOptions>>,
  ): void {
    for (const [key, cfg] of Object.entries(configs)) {
      if (!cfg) continue

      const bucketLen = cfg.bucketLen ?? defaultBucketLen(cfg.normalize)
      const mapKey = prefilterMapKey(key, cfg.normalize)

      const eq = new Map<string, Set<string>>()
      const prefixBuckets = new Map<string, Set<string>>()
      const valuesByDoc = new Map<string, string[]>()

      for (const [docId, doc] of this.docs) {
        const normVals = readStringField(doc, key, cfg.normalize)
        valuesByDoc.set(docId, normVals)

        for (const v of normVals) {
          let s = eq.get(v)
          if (!s) eq.set(v, (s = new Set()))
          s.add(docId)

          const b = v.slice(0, Math.min(bucketLen, v.length))
          let pb = prefixBuckets.get(b)
          if (!pb) prefixBuckets.set(b, (pb = new Set()))
          pb.add(docId)
        }
      }

      this.prefilters.set(mapKey, {
        key,
        normalize: cfg.normalize,
        eq,
        prefixBuckets,
        valuesByDoc,
        bucketLen,
      })
    }
  }

  /**
   * Compute an allowed doc-id set implied by indexed filter metadata.
   *
   * Returns:
   * - null if no applicable prefilter indices are available
   * - Set<string> otherwise
   */
  private computePrefilterAllowed(
    filters: Array<IndexedFilter<TDoc> | ((doc: TDoc) => boolean)>,
  ): Set<string> | null {
    const descs: PrefilterDescriptor[] = []
    for (const f of filters) {
      const pf = (f as IndexedFilter<TDoc>).__prefilter
      if (pf && pf.needles.length > 0) descs.push(pf)
    }
    if (descs.length === 0) return null

    const sets: Set<string>[] = []

    for (const d of descs) {
      // Only accelerate eq + startsWith
      if (d.mode !== 'equals' && d.mode !== 'startsWith') continue

      const idx = this.prefilters.get(prefilterMapKey(d.key, d.normalize))
      if (!idx) continue

      const s = deriveSetForDescriptor(idx, d)
      if (s) sets.push(s)
    }

    if (sets.length === 0) return null

    // AND across accelerated filters => intersect
    return intersectAllSets(sets)
  }

  // ----------------------------
  // Search index construction
  // ----------------------------

  private buildSearchIndex(docs: TDoc[]): void {
    for (const f of this.textFields) {
      this.fieldStats.set(f.key, { totalLen: 0, avgLen: 1 })
    }

    for (const doc of docs) {
      if (!doc?.id) continue
      this.docs.set(doc.id, doc)
      this.N++

      const perTerm = new Map<
        string,
        Map<string, { tf: number; pos?: number[] }>
      >()
      const dlByField = new Map<string, number>()

      for (const field of this.textFields) {
        const fieldId = field.key
        const raw = doc[fieldId] as unknown
        const combined = Array.isArray(raw)
          ? raw.join('\n')
          : typeof raw === 'string'
            ? raw
            : ''
        const terms = tokenize(normalizeText(combined), this.maxTokenLength)

        dlByField.set(fieldId, terms.length)

        const stat = this.fieldStats.get(fieldId)!
        stat.totalLen += terms.length

        for (let i = 0; i < terms.length; i++) {
          const term = terms[i]

          let fieldMap = perTerm.get(term)
          if (!fieldMap) perTerm.set(term, (fieldMap = new Map()))

          let rec = fieldMap.get(fieldId)
          if (!rec) {
            rec = { tf: 0, pos: field.opts.proximityBoost ? [] : undefined }
            fieldMap.set(fieldId, rec)
          }

          rec.tf++
          if (
            field.opts.proximityBoost &&
            rec.pos &&
            rec.pos.length < this.maxPositionsPerTermPerDoc
          ) {
            rec.pos.push(i)
          }
        }
      }

      this.fieldLenByDoc.set(doc.id, dlByField)

      for (const [term, fields] of perTerm) {
        this.vocab.add(term)
        const list = this.postingsByTerm.get(term)
        const posting: DocTermPosting = { docId: doc.id, fields }
        if (list) list.push(posting)
        else this.postingsByTerm.set(term, [posting])
      }
    }

    for (const [, s] of this.fieldStats) {
      s.avgLen = Math.max(1, s.totalLen / Math.max(1, this.N))
    }

    for (const [term, postings] of this.postingsByTerm) {
      this.dfByTerm.set(term, postings.length)
      this.precomputeTermForFuzzy(term)
    }
  }

  // ----------------------------
  // Phrase / order boosts
  // ----------------------------

  private applyPhraseBoost(
    phraseTerms: string[],
    docScores: Map<string, number>,
    positionsCache: Map<string, Map<string, Map<string, number[]>>>,
  ): void {
    for (const [docId] of docScores) {
      const byField = positionsCache.get(docId)
      if (!byField) continue

      let bestSpan = Infinity
      let bestFieldWeight = 1

      for (const f of this.textFields) {
        if (!f.opts.proximityBoost) continue

        const byTerm = byField.get(f.key)
        if (!byTerm) continue

        const lists: number[][] = []
        let ok = true
        for (const t of phraseTerms) {
          const pos = byTerm.get(t)
          if (!pos || pos.length === 0) {
            ok = false
            break
          }
          lists.push(pos)
        }
        if (!ok) continue

        const span = minOrderedSpan(lists)
        if (span < bestSpan) {
          bestSpan = span
          bestFieldWeight = f.opts.weight
        }
      }

      if (bestSpan === Infinity) continue

      const base = docScores.get(docId) ?? 0
      const isExact = bestSpan === phraseTerms.length - 1
      const prox = proximityFactor(bestSpan, 18)
      const inc =
        phraseTerms.length *
          this.phraseBoost *
          (0.6 + 1.2 * prox) *
          (0.6 + 0.4 * bestFieldWeight) +
        (isExact ? this.exactPhraseBoost : 0)

      docScores.set(docId, base + inc)
    }
  }

  private applyInOrderBoost(
    orderedTerms: string[],
    docScores: Map<string, number>,
    positionsCache: Map<string, Map<string, Map<string, number[]>>>,
  ): void {
    for (const [docId] of docScores) {
      const byField = positionsCache.get(docId)
      if (!byField) continue

      let bestSpan = Infinity
      let bestFieldWeight = 1

      for (const f of this.textFields) {
        if (!f.opts.proximityBoost) continue

        const byTerm = byField.get(f.key)
        if (!byTerm) continue

        const lists: number[][] = []
        let ok = true
        for (const t of orderedTerms) {
          const pos = byTerm.get(t)
          if (!pos || pos.length === 0) {
            ok = false
            break
          }
          lists.push(pos)
        }
        if (!ok) continue

        const span = minOrderedSpan(lists)
        if (span < bestSpan) {
          bestSpan = span
          bestFieldWeight = f.opts.weight
        }
      }

      if (bestSpan === Infinity) continue

      const base = docScores.get(docId) ?? 0
      const prox = proximityFactor(bestSpan, 28)
      const isExact = bestSpan === orderedTerms.length - 1
      const inc =
        orderedTerms.length *
          this.inOrderBoost *
          (0.5 + prox) *
          (0.6 + 0.4 * bestFieldWeight) +
        (isExact ? 1.5 : 0)

      docScores.set(docId, base + inc)
    }
  }

  // ----------------------------
  // Fuzzy candidate generation
  // ----------------------------

  private precomputeTermForFuzzy(term: string): void {
    const tris = getTrigrams(term)
    this.trigramsByTerm.set(term, tris)

    for (const tri of tris) {
      const arr = this.termsByTrigram.get(tri)
      if (arr) arr.push(term)
      else this.termsByTrigram.set(tri, [term])
    }

    if (term.length >= 2) {
      const p2 = term.slice(0, 2)
      const arr = this.termsByPrefix2.get(p2)
      if (arr) arr.push(term)
      else this.termsByPrefix2.set(p2, [term])
    }
  }

  private getTermCandidates(
    queryTerm: string,
    fuzzyMaxCandidates: number,
  ): TermCandidate[] {
    if (this.vocab.has(queryTerm)) return [{ term: queryTerm, weight: 1 }]

    // Very short terms: only allow prefix-based fuzzy candidates.
    if (queryTerm.length <= 3) {
      if (queryTerm.length >= 2) {
        const bucket = this.termsByPrefix2.get(queryTerm.slice(0, 2)) ?? []
        return bucket
          .filter((t) => t.startsWith(queryTerm))
          .slice(0, Math.min(16, bucket.length))
          .map((t) => ({ term: t, weight: 0.85 }))
      }
      return []
    }

    const qTris = getTrigrams(queryTerm)
    if (qTris.length === 0) return []

    // Trigram overlap candidate pool
    const hits = new Map<string, number>()
    for (const tri of qTris) {
      const terms = this.termsByTrigram.get(tri)
      if (!terms) continue
      for (const t of terms) hits.set(t, (hits.get(t) ?? 0) + 1)
    }
    if (hits.size === 0) return []

    const scored: { term: string; overlap: number }[] = []
    for (const [t, overlap] of hits) scored.push({ term: t, overlap })
    scored.sort((a, b) => b.overlap - a.overlap)

    const top = scored.slice(0, fuzzyMaxCandidates)

    // Verify with Jaccard + bounded Levenshtein for precision.
    const out: TermCandidate[] = []
    const qSet = new Set(qTris)
    const maxDist = maxEditDistance(queryTerm.length)

    for (const item of top) {
      const t = item.term
      const tTris = this.trigramsByTerm.get(t) ?? getTrigrams(t)
      const j = jaccard(qSet, tTris)
      if (j < 0.28) continue

      const dist = levenshteinBounded(queryTerm, t, maxDist)
      if (dist === Infinity) continue

      out.push({ term: t, weight: fuzzyWeight(dist, queryTerm.length, j) })
    }

    out.sort((a, b) => b.weight - a.weight)
    return out.slice(0, 8)
  }
}

/* ---------------------------------------
 * Friendly BM25 resolver (no raw BM25 option exposed)
 * ------------------------------------ */

/**
 * Resolve BM25 parameters for a field using the friendly knobs.
 *
 * @param opts Field options.
 * @param computedAvgLen Average token length computed at indexing time for this field.
 * @param defaultK1 Default BM25 k1.
 * @param defaultB Default BM25 b.
 */
function resolveBm25(
  opts: TextFieldOptions,
  computedAvgLen: number,
  defaultK1: number,
  defaultB: number,
): { k1: number; b: number; avgLenHint: number } {
  // frequencySaturation -> k1
  const fs = opts.frequencySaturation ?? 'medium'
  let k1 =
    typeof fs === 'number'
      ? fs
      : fs === 'low'
        ? 0.6
        : fs === 'high'
          ? 1.8
          : defaultK1

  // lengthNormalization -> b
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

  // expectedLength -> avgdl hint
  let avgLenHint = opts.expectedLength ?? computedAvgLen

  // Safety clamps / fallbacks
  if (!Number.isFinite(k1) || k1 <= 0) k1 = defaultK1
  if (!Number.isFinite(b)) b = defaultB
  if (b < 0) b = 0
  if (b > 1) b = 1
  if (!Number.isFinite(avgLenHint) || avgLenHint <= 0)
    avgLenHint = computedAvgLen

  return { k1, b, avgLenHint }
}

/* ---------------------------------------
 * Prefilter derivation
 * ------------------------------------ */

function deriveSetForDescriptor(
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

      // Verify actual startsWith against stored normalized values
      const verified = new Set<string>()
      for (const docId of bucketSet) {
        const vals = idx.valuesByDoc.get(docId) ?? []
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

function prefilterMapKey(key: string, normalize: NormalizeMode): string {
  return `${key}|${normalize}`
}

function defaultBucketLen(normalize: NormalizeMode): number {
  // Folded text tends to have broader collisions; use a slightly longer bucket.
  return normalize === 'fold' ? 3 : 2
}

/* ---------------------------------------
 * Filters + sets
 * ------------------------------------ */

function passesAllFilters<TDoc>(
  doc: TDoc,
  filters: Array<IndexedFilter<TDoc> | ((doc: TDoc) => boolean)>,
): boolean {
  for (const f of filters) if (!f(doc)) return false
  return true
}

function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
  if (a.size > b.size) return intersectSets(b, a)
  const out = new Set<string>()
  for (const x of a) if (b.has(x)) out.add(x)
  return out
}

function intersectAllSets(sets: Set<string>[]): Set<string> {
  sets.sort((a, b) => a.size - b.size)
  let out = sets[0]
  for (let i = 1; i < sets.length; i++) {
    out = intersectSets(out, sets[i])
    if (out.size === 0) break
  }
  return out
}

/* ---------------------------------------
 * Query parsing + normalization
 * ------------------------------------ */

/**
 * Parse query into tokens; quoted segments become phrase tokens.
 *
 * - Words between single or double quotes become one phrase token.
 * - Non-quoted sequences are split on whitespace into term tokens.
 */
function parseQuery(input: string): ParsedQueryToken[] {
  const s = input.trim()
  if (!s) return []

  const tokens: ParsedQueryToken[] = []
  let i = 0

  while (i < s.length) {
    while (i < s.length && isSpace(s[i])) i++
    if (i >= s.length) break

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

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f'
}

function normalizeQueryToken(
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

/* ---------------------------------------
 * Normalization + tokenization
 * ------------------------------------ */

/** Diacritics-folded lowercasing. */
function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")
}

/** Normalize text used in the search index (folded). */
function normalizeText(text: string): string {
  return foldText(text)
}

/** Tokenize normalized text into alphanumeric word tokens. */
function tokenize(normalizedText: string, maxTokenLength: number): string[] {
  const out: string[] = []
  const re = /[\p{L}\p{N}]+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(normalizedText))) {
    const t = m[0]
    if (!t) continue
    if (t.length > maxTokenLength) continue
    out.push(t)
  }
  return out
}

function normalizeValue(v: string, mode: NormalizeMode): string {
  const s = String(v ?? '')
  if (mode === 'none') return s
  if (mode === 'trim') return s.trim()
  return foldText(s).trim()
}

function normalizeNeedleArray(arr: string[], mode: NormalizeMode): string[] {
  const out: string[] = []
  for (const x of arr ?? []) {
    const v = normalizeValue(x, mode)
    if (v) out.push(v)
  }
  return Array.from(new Set(out))
}

function makeMatcher(
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
function readStringField<TDoc extends FilterableDoc>(
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

/* ---------------------------------------
 * BM25 + proximity + fuzzy
 * ------------------------------------ */

function bm25Idf(N: number, df: number): number {
  return Math.log(1 + (N - df + 0.5) / (df + 0.5))
}

function bm25Score(
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
function minOrderedSpan(posLists: number[][]): number {
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

function firstGreaterThan(arr: number[], x: number): number | null {
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

function proximityFactor(span: number, window: number): number {
  if (span <= 0) return 1
  if (span >= window) return 0
  return 1 - span / window
}

function getTrigrams(s: string): string[] {
  const x = `^${s}$`
  const tris: string[] = []
  for (let i = 0; i + 3 <= x.length; i++) tris.push(x.slice(i, i + 3))
  return tris
}

function maxEditDistance(len: number): number {
  if (len <= 4) return 1
  if (len <= 7) return 2
  return 3
}

function jaccard(qSet: Set<string>, tTris: string[]): number {
  if (tTris.length === 0) return 0
  let inter = 0
  const tSet = new Set(tTris)
  for (const tri of qSet) if (tSet.has(tri)) inter++
  const union = qSet.size + tSet.size - inter
  return union === 0 ? 0 : inter / union
}

function fuzzyWeight(dist: number, qLen: number, j: number): number {
  const d = dist / Math.max(1, qLen)
  const base = 0.55 + 0.45 * j
  const penalty = Math.min(0.35, d * 0.9)
  return clamp01(base - penalty)
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

/**
 * Bounded Levenshtein distance with early exit:
 * returns Infinity if distance exceeds maxDist.
 */
function levenshteinBounded(a: string, b: string, maxDist: number): number {
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
  return d > maxDist ? Infinity : d
}
