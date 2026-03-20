import parseAttrs from 'attributes-parser'

type Range = { start: number; end: number }
type UrlParse = { urlStart: number; urlEnd: number; i: number }
type Opener = { kind: 'link' | 'image'; active: boolean }
type MdUrlSpan = {
  kind: 'link' | 'image'
  line: number
  colStart: number
  colEnd: number
}
type HtmlAttrUrlSpan = {
  attr: 'src' | 'href' | 'srcset'
  line: number
  colStart: number
  colEnd: number // exclusive
}
type RefDefUrlSpan = {
  line: number
  colStart: number
  colEnd: number
}
type BlockDelim = readonly [start: string, end: string]
type Syntax = {
  line: readonly string[]
  block: readonly BlockDelim[]
  supportsBacktickString?: boolean
  pythonDocstrings?: boolean
}

const MAX_LEADING_SPACES = 3

const CH_SPACE = ' '.charCodeAt(0)
const CH_TAB = '\t'.charCodeAt(0)
const CH_LF = '\n'.charCodeAt(0)
const CH_CR = '\r'.charCodeAt(0)

const CH_BACKTICK = '`'.charCodeAt(0)
const CH_LT = '<'.charCodeAt(0)
const CH_GT = '>'.charCodeAt(0)
const CH_DQUOTE = '"'.charCodeAt(0)
const CH_SQUOTE = "'".charCodeAt(0)
const CH_EQ = '='.charCodeAt(0)

const CH_BACKSLASH = '\\'.charCodeAt(0)

const CH_SLASH = '/'.charCodeAt(0)
const CH_BANG = '!'.charCodeAt(0)
const CH_QMARK = '?'.charCodeAt(0)
const CH_LBRACK = '['.charCodeAt(0)
const CH_RBRACK = ']'.charCodeAt(0)
const CH_LBRACE = '{'.charCodeAt(0)
const CH_RBRACE = '}'.charCodeAt(0)
const CH_COLON = ':'.charCodeAt(0)
const CH_DASH = '-'.charCodeAt(0)
const CH_UNDERSCORE = '_'.charCodeAt(0)
const CH_COMMA = ','.charCodeAt(0)

const CH_LPAREN = '('.charCodeAt(0)
const CH_RPAREN = ')'.charCodeAt(0)

const CH_0 = '0'.charCodeAt(0)
const CH_9 = '9'.charCodeAt(0)
const CH_A = 'A'.charCodeAt(0)
const CH_Z = 'Z'.charCodeAt(0)
const CH_a = 'a'.charCodeAt(0)
const CH_z = 'z'.charCodeAt(0)

const SYNTAX: Record<string, Syntax> = {
  c: { line: ['//'], block: [['/*', '*/']], supportsBacktickString: false },
  cpp: { line: ['//'], block: [['/*', '*/']], supportsBacktickString: false },
  java: { line: ['//'], block: [['/*', '*/']], supportsBacktickString: false },
  javascript: {
    line: ['//'],
    block: [['/*', '*/']],
    supportsBacktickString: true,
  },
  go: { line: ['//'], block: [['/*', '*/']], supportsBacktickString: true },
  rust: { line: ['//'], block: [['/*', '*/']], supportsBacktickString: true },
  csharp: {
    line: ['//'],
    block: [['/*', '*/']],
    supportsBacktickString: false,
  },
  swift: { line: ['//'], block: [['/*', '*/']], supportsBacktickString: false },
  kotlin: {
    line: ['//'],
    block: [['/*', '*/']],
    supportsBacktickString: false,
  },
  sql: { line: ['--'], block: [['/*', '*/']], supportsBacktickString: false },
  css: { line: [], block: [['/*', '*/']], supportsBacktickString: false },

  python: {
    line: ['#'],
    block: [],
    supportsBacktickString: false,
    pythonDocstrings: true,
  },

  ruby: {
    line: ['#'],
    block: [['=begin', '=end']],
    supportsBacktickString: false,
  },
  sh: { line: ['#'], block: [], supportsBacktickString: false },
  bash: { line: ['#'], block: [], supportsBacktickString: false },
  zsh: { line: ['#'], block: [], supportsBacktickString: false },

  lua: { line: ['--'], block: [['--[[', ']]']], supportsBacktickString: false },
}

const Helpers = {
  isWs: (c: number) =>
    c === CH_SPACE || c === CH_TAB || c === CH_LF || c === CH_CR,
  isSpTab: (c: number) => c === CH_SPACE || c === CH_TAB,
  isLineEnd: (c: number) => c === CH_LF || c === CH_CR,

  isAsciiLetter: (c: number) =>
    (c >= CH_A && c <= CH_Z) || (c >= CH_a && c <= CH_z),
  isAttrNameChar: (c: number) =>
    (c >= CH_0 && c <= CH_9) ||
    (c >= CH_A && c <= CH_Z) ||
    (c >= CH_a && c <= CH_z) ||
    c === CH_DASH ||
    c === CH_UNDERSCORE ||
    c === CH_COLON,

  lowerAscii: (c: number) => (c <= CH_Z ? c + 32 : c),

  startsWithAsciiCI: (src: string, at: number, s: string) => {
    if (at + s.length > src.length) return false
    for (let i = 0; i < s.length; i++) {
      if (
        Helpers.lowerAscii(src.charCodeAt(at + i)) !==
        Helpers.lowerAscii(s.charCodeAt(i))
      )
        return false
    }
    return true
  },

  findTagEnd: (src: string, from: number) => {
    let q = 0
    for (let i = from; i < src.length; i++) {
      const ch = src.charCodeAt(i)
      if (q) {
        if (ch === q) q = 0
        continue
      }
      if (ch === CH_DQUOTE || ch === CH_SQUOTE) {
        q = ch
        continue
      }
      if (ch === CH_GT) return i
    }
    return -1
  },

  readTagNameLower: (src: string, lt: number) => {
    let i = lt + 1
    while (
      i < src.length &&
      (src.charCodeAt(i) === 32 || src.charCodeAt(i) === 9)
    )
      i++
    if (
      i < src.length &&
      (src.charCodeAt(i) === 47 ||
        src.charCodeAt(i) === 33 ||
        src.charCodeAt(i) === 63)
    ) {
      i++
      while (
        i < src.length &&
        (src.charCodeAt(i) === 32 || src.charCodeAt(i) === 9)
      )
        i++
    }
    const start = i
    while (i < src.length && Helpers.isAsciiLetter(src.charCodeAt(i))) i++
    return src.slice(start, i).toLowerCase()
  },

  isNameBoundary: (src: string, i: number) => {
    if (i >= src.length) return true
    const c = src.charCodeAt(i)
    return (
      c === CH_GT || c === 47 || c === 32 || c === 9 || c === 10 || c === 13
    )
  },

  buildLineStarts: (src: string) => {
    const starts = [0]
    for (let i = 0; i < src.length; i++) {
      const ch = src.charCodeAt(i)
      if (ch === CH_LF) starts.push(i + 1)
      else if (ch === CH_CR) {
        if (i + 1 < src.length && src.charCodeAt(i + 1) === CH_LF) i++
        starts.push(i + 1)
      }
    }
    return starts
  },

  upperBound: (arr: number[], x: number) => {
    let lo = 0
    let hi = arr.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (arr[mid] <= x) lo = mid + 1
      else hi = mid
    }
    return lo
  },

  indexToLineCol: (lineStarts: number[], idx: number) => {
    const line = Math.max(0, Helpers.upperBound(lineStarts, idx) - 1)
    return { line, col: idx - lineStarts[line] }
  },

  skipSpTab: (src: string, i: number) => {
    while (i < src.length && Helpers.isSpTab(src.charCodeAt(i))) i++
    return i
  },

  skipSep: (src: string, i: number) => {
    i = Helpers.skipSpTab(src, i)
    if (i >= src.length) return i
    const ch = src.charCodeAt(i)
    if (ch === CH_LF) return Helpers.skipSpTab(src, i + 1)
    if (ch === CH_CR) {
      i++
      if (i < src.length && src.charCodeAt(i) === CH_LF) i++
      return Helpers.skipSpTab(src, i)
    }
    return i
  },

  trimWs: (src: string, a: number, b: number) => {
    while (a < b && Helpers.isWs(src.charCodeAt(a))) a++
    while (b > a && Helpers.isWs(src.charCodeAt(b - 1))) b--
    return { a, b }
  },

  scanLabelEndOnLine: (src: string, lb: number, lineEnd: number) => {
    let depth = 0
    for (let i = lb + 1; i < lineEnd; i++) {
      const ch = src.charCodeAt(i)
      if (ch === CH_BACKSLASH) {
        i++
        continue
      }
      if (ch === CH_LBRACK) depth++
      else if (ch === CH_RBRACK) {
        if (depth === 0) return i
        depth--
      }
    }
    return -1
  },

  matchNameCI: (src: string, start: number, end: number, name: string) => {
    if (end - start !== name.length) return false
    for (let i = 0; i < name.length; i++) {
      if (Helpers.lowerAscii(src.charCodeAt(start + i)) !== name.charCodeAt(i))
        return false
    }
    return true
  },
  pushIfSingleLine: (
    lineStarts: number[],
    out: HtmlAttrUrlSpan[],
    attr: HtmlAttrUrlSpan['attr'],
    start: number,
    end: number,
  ) => {
    if (end <= start) return
    const a = Helpers.indexToLineCol(lineStarts, start)
    const b = Helpers.indexToLineCol(lineStarts, end)
    if (a.line !== b.line) return
    out.push({ attr, line: a.line, colStart: a.col, colEnd: b.col })
  },

  lineStartIndex(s: string, i: number): number {
    const j = s.lastIndexOf('\n', i - 1)
    return j === -1 ? 0 : j + 1
  },

  prevNonWsSameLine(s: string, i: number): number {
    let j = i - 1
    const ls = Helpers.lineStartIndex(s, i)
    while (j >= ls && Helpers.isWs(s.charCodeAt(j))) j--
    return j
  },

  isOnlyWsSinceLineStart(s: string, i: number): boolean {
    const ls = Helpers.lineStartIndex(s, i)
    for (let j = ls; j < i; j++)
      if (!Helpers.isWs(s.charCodeAt(j))) return false
    return true
  },

  isPythonDocstringStart(s: string, i: number): "'''" | '"""' | null {
    if (!(s.startsWith("'''", i) || s.startsWith('"""', i))) return null

    if (!Helpers.isOnlyWsSinceLineStart(s, i)) return null

    const ls = Helpers.lineStartIndex(s, i)
    if (ls === 0) return s.slice(i, i + 3) as "'''" | '"""'

    const p = Helpers.prevNonWsSameLine(s, ls)
    if (p < 0) return s.slice(i, i + 3) as "'''" | '"""'

    const ch = s.charCodeAt(p)
    if (ch === 0x3a /* : */) return s.slice(i, i + 3) as "'''" | '"""'

    return null
  },
}

const Ranges = {
  codeSpans(src: string): Range[] {
    const out: Range[] = []
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) !== CH_BACKTICK) continue

      let fence = 1
      while (
        i + fence < src.length &&
        src.charCodeAt(i + fence) === CH_BACKTICK
      )
        fence++

      const contentStart = i + fence
      let j = contentStart

      while (j < src.length) {
        if (src.charCodeAt(j) !== CH_BACKTICK) {
          j++
          continue
        }
        let k = 1
        while (j + k < src.length && src.charCodeAt(j + k) === CH_BACKTICK) k++
        if (k === fence) {
          out.push({ start: contentStart, end: j })
          i = j + k - 1
          break
        }
        j += k
      }
    }
    return out
  },

  htmlComments(src: string): Range[] {
    const out: Range[] = []
    let i = 0
    while (i < src.length) {
      const lt = src.indexOf('<!--', i)
      if (lt === -1) break
      const contentStart = lt + 4
      const end = src.indexOf('-->', contentStart)
      if (end === -1) break
      out.push({ start: contentStart, end })
      i = end + 3
    }
    return out
  },

  htmlConstructs(src: string, rawTextTags: readonly string[]): Range[] {
    const out: Range[] = []
    const wantRaw = new Set(rawTextTags.map((t) => t.toLowerCase()))

    let i = 0
    while (i < src.length) {
      const lt = src.indexOf('<', i)
      if (lt === -1) break

      if (src.startsWith('<!--', lt)) {
        const contentStart = lt + 4
        const end = src.indexOf('-->', contentStart)
        if (end === -1) break
        out.push({ start: contentStart, end })
        i = end + 3
        continue
      }

      const tagEnd = Helpers.findTagEnd(src, lt + 1)
      if (tagEnd === -1) break

      const name = Helpers.readTagNameLower(src, lt)

      // attribute values
      {
        let p = lt + 1

        while (p < tagEnd && Helpers.isSpTab(src.charCodeAt(p))) p++

        if (p < tagEnd) {
          const c0 = src.charCodeAt(p)
          if (c0 === CH_SLASH || c0 === CH_BANG || c0 === CH_QMARK) p++
        }

        while (p < tagEnd && Helpers.isSpTab(src.charCodeAt(p))) p++

        while (p < tagEnd) {
          const c = src.charCodeAt(p)
          if (Helpers.isWs(c) || c === CH_SLASH) break
          p++
        }

        while (p < tagEnd) {
          while (p < tagEnd && Helpers.isWs(src.charCodeAt(p))) p++
          if (p >= tagEnd) break
          if (src.charCodeAt(p) === CH_SLASH) break

          const nameStart = p
          while (p < tagEnd) {
            const c = src.charCodeAt(p)
            if (Helpers.isWs(c) || c === CH_EQ || c === CH_GT || c === CH_SLASH)
              break
            p++
          }
          if (p === nameStart) {
            p++
            continue
          }

          while (p < tagEnd && Helpers.isWs(src.charCodeAt(p))) p++
          if (p >= tagEnd || src.charCodeAt(p) !== CH_EQ) continue

          p++
          while (p < tagEnd && Helpers.isWs(src.charCodeAt(p))) p++
          if (p >= tagEnd) break

          const v0 = src.charCodeAt(p)
          if (v0 === CH_DQUOTE || v0 === CH_SQUOTE) {
            const quote = v0
            const valStart = p + 1
            p = valStart
            while (p < tagEnd && src.charCodeAt(p) !== quote) p++
            out.push({ start: valStart, end: p })
            if (p < tagEnd && src.charCodeAt(p) === quote) p++
          } else {
            const valStart = p
            while (p < tagEnd) {
              const c2 = src.charCodeAt(p)
              if (Helpers.isWs(c2) || c2 === CH_GT || c2 === CH_SLASH) break
              p++
            }
            out.push({ start: valStart, end: p })
          }
        }
      }

      // raw-text body
      let p0 = lt + 1
      while (p0 < tagEnd && Helpers.isSpTab(src.charCodeAt(p0))) p0++
      const isEndTag = p0 < tagEnd && src.charCodeAt(p0) === CH_SLASH

      if (!isEndTag && name && wantRaw.has(name)) {
        const bodyStart = tagEnd + 1
        let p = bodyStart

        while (true) {
          const closeLt = src.indexOf('<', p)
          if (closeLt === -1) {
            i = src.length
            break
          }
          if (
            Helpers.startsWithAsciiCI(src, closeLt + 1, '/' + name) &&
            Helpers.isNameBoundary(src, closeLt + 2 + name.length)
          ) {
            out.push({ start: bodyStart, end: closeLt })
            i = closeLt
            break
          }
          p = closeLt + 1
        }

        continue
      }

      i = tagEnd + 1
    }

    return out
  },

  codeSnippetComments(code: string, lang: string): Range[] {
    const syn = SYNTAX[lang.toLowerCase()] ?? {
      line: ['//'],
      block: [['/*', '*/']],
    }
    const out: Range[] = []

    const lineStarts = syn.line.slice().sort((a, b) => b.length - a.length)
    const blockStarts = syn.block
      .slice()
      .sort((a, b) => b[0].length - a[0].length)

    let i = 0
    const n = code.length

    let inBlock: { end: string; start: number } | null = null
    let inString: {
      q: "'" | '"' | '`'
      triple?: boolean
      start: number
    } | null = null

    while (i < n) {
      if (inBlock) {
        if (code.startsWith(inBlock.end, i)) {
          const end = i + inBlock.end.length
          out.push({ start: inBlock.start, end })
          i = end
          inBlock = null
          continue
        }
        i++
        continue
      }

      if (inString) {
        const q = inString.q
        if (inString.triple) {
          const tri = q.repeat(3)
          if (code.startsWith(tri, i)) {
            i += 3
            inString = null
            continue
          }
          i++
          continue
        }

        const ch = code.charCodeAt(i)
        if (ch === 0x5c /* \ */) {
          i += 2
          continue
        }
        if (code[i] === q) {
          i++
          inString = null
          continue
        }
        i++
        continue
      }

      const c = code[i]

      if (syn.pythonDocstrings) {
        const tri = Helpers.isPythonDocstringStart(code, i)
        if (tri) {
          const endDelim = tri
          const start = i
          i += 3
          while (i < n && !code.startsWith(endDelim, i)) i++
          if (i < n) i += 3
          out.push({ start, end: i })
          continue
        }
      }

      for (const [bStart, bEnd] of blockStarts) {
        if (code.startsWith(bStart, i)) {
          inBlock = { start: i, end: bEnd }
          i += bStart.length
          break
        }
      }
      if (inBlock) continue

      for (const ls of lineStarts) {
        if (code.startsWith(ls, i)) {
          const start = i
          const nl = code.indexOf('\n', i + ls.length)
          const end = nl === -1 ? n : nl
          out.push({ start, end })
          i = end
          break
        }
      }

      if (c === "'" || c === '"') {
        const q = c as "'" | '"'
        const triple = code.startsWith(q.repeat(3), i)
        inString = { q, triple, start: i }
        i += triple ? 3 : 1
        continue
      }

      if (c === '`' && syn.supportsBacktickString) {
        inString = { q: '`', start: i }
        i++
        continue
      }

      i++
    }

    return out
  },

  invertRanges(ranges: readonly Range[], min: number, max: number): Range[] {
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)

    const normalized: Range[] = []
    for (const r of ranges) {
      let s = Math.min(r.start, r.end)
      let e = Math.max(r.start, r.end)
      if (e <= lo || s >= hi) continue
      s = Math.max(s, lo)
      e = Math.min(e, hi)
      if (s < e) normalized.push({ start: s, end: e })
    }

    normalized.sort((a, b) => a.start - b.start || a.end - b.end)

    const merged: Range[] = []
    for (const r of normalized) {
      const last = merged[merged.length - 1]
      if (!last || r.start > last.end)
        merged.push({ start: r.start, end: r.end })
      else if (r.end > last.end) last.end = r.end
    }

    const out: Range[] = []
    let cursor = lo
    for (const r of merged) {
      if (cursor < r.start) out.push({ start: cursor, end: r.start })
      cursor = Math.max(cursor, r.end)
    }
    if (cursor < hi) out.push({ start: cursor, end: hi })

    return out
  },

  extract(src: string, ranges: Range[]) {
    const out = src.split('')
    for (const range of ranges) {
      const start = Math.max(0, range.start)
      const end = Math.min(src.length, range.end)
      for (let i = start; i < end; i++) {
        const ch = src.charCodeAt(i)
        if (ch !== CH_LF && ch !== CH_CR && ch !== CH_SPACE) {
          out[i] = ' '
        }
      }
    }
    return out.join('')
  },
}

const Detection = {
  parseQuotedTitle: (src: string, i: number, quote: number) => {
    i++
    let esc = false
    for (; i < src.length; i++) {
      const ch = src.charCodeAt(i)
      if (esc) {
        esc = false
        continue
      }
      if (ch === CH_BACKSLASH) {
        esc = true
        continue
      }
      if (ch === quote) return i + 1
    }
    return -1
  },

  parseParenTitle: (src: string, i: number) => {
    i++
    let esc = false
    let depth = 0
    for (; i < src.length; i++) {
      const ch = src.charCodeAt(i)
      if (esc) {
        esc = false
        continue
      }
      if (ch === CH_BACKSLASH) {
        esc = true
        continue
      }
      if (ch === CH_LPAREN) depth++
      else if (ch === CH_RPAREN) {
        if (depth === 0) return i + 1
        depth--
      }
    }
    return -1
  },

  parseLinkDestination: (
    src: string,
    i: number,
    stopAtCloseParen: boolean,
  ): UrlParse | null => {
    if (i >= src.length) return null

    if (src.charCodeAt(i) === CH_LT) {
      const urlStart = i + 1
      const gt = src.indexOf('>', urlStart)
      if (gt < 0) return null
      return { urlStart, urlEnd: gt, i: gt + 1 }
    }

    const urlStart = i
    let depth = 0
    let esc = false

    for (; i < src.length; i++) {
      const ch = src.charCodeAt(i)

      if (esc) {
        esc = false
        continue
      }
      if (ch === CH_BACKSLASH) {
        esc = true
        continue
      }
      if (ch === CH_LF || ch === CH_CR) return null
      if (Helpers.isWs(ch)) break

      if (ch === CH_LPAREN) depth++
      else if (ch === CH_RPAREN) {
        if (stopAtCloseParen && depth === 0) break
        depth--
        if (depth < 0) return null
      }
    }

    if (i === urlStart) return null
    return { urlStart, urlEnd: i, i }
  },

  parseInlineDestInParens: (src: string, parenPos: number) => {
    let i = parenPos + 1
    i = Helpers.skipSep(src, i)

    const dest = Detection.parseLinkDestination(src, i, true)
    if (!dest) return null
    i = dest.i

    i = Helpers.skipSep(src, i)
    if (i >= src.length) return null

    if (src.charCodeAt(i) === CH_RPAREN) {
      return { urlStart: dest.urlStart, urlEnd: dest.urlEnd, end: i + 1 }
    }

    const q = src.charCodeAt(i)
    if (q === CH_DQUOTE || q === CH_SQUOTE) {
      const j = Detection.parseQuotedTitle(src, i, q)
      if (j < 0) return null
      i = Helpers.skipSep(src, j)
      if (i < src.length && src.charCodeAt(i) === CH_RPAREN) {
        return { urlStart: dest.urlStart, urlEnd: dest.urlEnd, end: i + 1 }
      }
      return null
    }

    if (q === CH_LPAREN) {
      const j = Detection.parseParenTitle(src, i)
      if (j < 0) return null
      i = Helpers.skipSep(src, j)
      if (i < src.length && src.charCodeAt(i) === CH_RPAREN) {
        return { urlStart: dest.urlStart, urlEnd: dest.urlEnd, end: i + 1 }
      }
      return null
    }

    return null
  },

  parseSrcsetUrls: (
    src: string,
    a: number,
    b: number,
    lineStarts: number[],
    out: HtmlAttrUrlSpan[],
  ) => {
    let i = a
    while (i < b) {
      while (i < b && Helpers.isWs(src.charCodeAt(i))) i++
      if (i >= b) break

      const urlStart = i
      while (i < b) {
        const ch = src.charCodeAt(i)
        if (ch === CH_COMMA || Helpers.isWs(ch)) break
        i++
      }
      const urlEnd = i
      Helpers.pushIfSingleLine(lineStarts, out, 'srcset', urlStart, urlEnd)

      while (i < b && src.charCodeAt(i) !== CH_COMMA) i++
      if (i < b && src.charCodeAt(i) === CH_COMMA) i++
    }
  },

  parseRefDefDestination: (src: string, i: number) => {
    if (i >= src.length) return null

    if (src.charCodeAt(i) === CH_LT) {
      const urlStart = i + 1
      for (let j = urlStart; j < src.length; j++) {
        const ch = src.charCodeAt(j)
        if (ch === CH_BACKSLASH) {
          j++
          continue
        }
        if (Helpers.isLineEnd(ch)) return null
        if (ch === CH_GT) return { urlStart, urlEnd: j }
      }
      return null
    }

    const urlStart = i
    while (i < src.length && !Helpers.isWs(src.charCodeAt(i))) i++
    if (i === urlStart) return null
    return { urlStart, urlEnd: i }
  },
}

export function neutralizeRanges(src: string): string {
  const ranges = [
    ...Ranges.codeSpans(src),
    ...Ranges.htmlConstructs(src, ['script', 'style']),
  ]
  return Ranges.extract(src, ranges)
}

export function keepOnlyCodeComments(src: string, language: string) {
  if (['ts', 'typescript', 'js'].includes(language)) {
    language = 'javascript'
  }
  if (['py'].includes(language)) {
    language = 'python'
  }
  if (['rb'].includes(language)) {
    language = 'ruby'
  }
  const codeComments = Ranges.codeSnippetComments(src, language)
  const ranges = Ranges.invertRanges(codeComments, 0, src.length)
  return Ranges.extract(src, ranges)
}

export function keepOnlyHtmlComments(src: string): string {
  const htmlComments = Ranges.htmlComments(src)
  const ranges = Ranges.invertRanges(htmlComments, 0, src.length)
  return Ranges.extract(src, ranges)
}

export function findInlineLinkAndImageUrls(src: string): MdUrlSpan[] {
  if (!src.includes('[') || !src.includes('(')) return []

  const lineStarts = Helpers.buildLineStarts(src)
  const out: MdUrlSpan[] = []

  const stack: Opener[] = []
  let bsRun = 0

  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i)

    if (ch === CH_BACKSLASH) {
      bsRun++
      continue
    }
    const escaped = (bsRun & 1) === 1
    bsRun = 0

    if (
      !escaped &&
      ch === CH_BANG &&
      i + 1 < src.length &&
      src.charCodeAt(i + 1) === CH_LBRACK
    ) {
      stack.push({ kind: 'image', active: true })
      i++
      continue
    }

    if (!escaped && ch === CH_LBRACK) {
      stack.push({ kind: 'link', active: true })
      continue
    }

    if (!escaped && ch === CH_RBRACK) {
      const opener = stack.pop()
      if (!opener || !opener.active) continue

      const j = i + 1
      if (j < src.length && src.charCodeAt(j) === CH_LPAREN) {
        const parsed = Detection.parseInlineDestInParens(src, j)
        if (parsed) {
          const a = Helpers.indexToLineCol(lineStarts, parsed.urlStart)
          const b = Helpers.indexToLineCol(lineStarts, parsed.urlEnd)
          if (a.line === b.line) {
            out.push({
              kind: opener.kind,
              line: a.line,
              colStart: a.col,
              colEnd: b.col,
            })
          }

          if (opener.kind === 'link') {
            for (let k = 0; k < stack.length; k++) {
              if (stack[k].kind === 'link') stack[k].active = false
            }
          }

          i = parsed.end - 1
        }
      }
    }
  }

  return out
}

export function findHtmlAttrUrls(src: string): HtmlAttrUrlSpan[] {
  if (!src.includes('=') || !src.includes('<') || !src.includes('>')) return []

  const out: HtmlAttrUrlSpan[] = []
  const lineStarts = Helpers.buildLineStarts(src)

  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt === -1) break

    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4)
      if (end === -1) break
      i = end + 3
      continue
    }

    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9)
      if (end === -1) break
      i = end + 3
      continue
    }

    const tagEnd = Helpers.findTagEnd(src, lt + 1)
    if (tagEnd === -1) break

    let p = lt + 1
    while (p < tagEnd && Helpers.isSpTab(src.charCodeAt(p))) p++

    if (p < tagEnd) {
      const c0 = src.charCodeAt(p)
      if (c0 === CH_SLASH || c0 === CH_BANG || c0 === CH_QMARK) {
        i = tagEnd + 1
        continue
      }
    }

    while (p < tagEnd && Helpers.isSpTab(src.charCodeAt(p))) p++
    while (
      p < tagEnd &&
      !Helpers.isWs(src.charCodeAt(p)) &&
      src.charCodeAt(p) !== CH_SLASH
    )
      p++

    while (p < tagEnd) {
      while (p < tagEnd && Helpers.isWs(src.charCodeAt(p))) p++
      if (p >= tagEnd) break
      if (src.charCodeAt(p) === CH_SLASH) break

      const nameStart = p
      while (p < tagEnd && Helpers.isAttrNameChar(src.charCodeAt(p))) p++
      const nameEnd = p
      if (nameEnd === nameStart) {
        p++
        continue
      }

      while (p < tagEnd && Helpers.isWs(src.charCodeAt(p))) p++
      if (p >= tagEnd || src.charCodeAt(p) !== CH_EQ) continue

      p++
      while (p < tagEnd && Helpers.isWs(src.charCodeAt(p))) p++
      if (p >= tagEnd) break

      let valStart = p
      let valEnd = p

      const q = src.charCodeAt(p)
      if (q === CH_DQUOTE || q === CH_SQUOTE) {
        const quote = q
        valStart = p + 1
        p = valStart
        while (p < tagEnd && src.charCodeAt(p) !== quote) p++
        valEnd = p
        if (p < tagEnd && src.charCodeAt(p) === quote) p++
      } else {
        while (p < tagEnd) {
          const c = src.charCodeAt(p)
          if (Helpers.isWs(c) || c === CH_GT || c === CH_SLASH) break
          p++
        }
        valEnd = p
      }

      const isSrc = Helpers.matchNameCI(src, nameStart, nameEnd, 'src')
      const isHref = Helpers.matchNameCI(src, nameStart, nameEnd, 'href')
      const isSrcset = Helpers.matchNameCI(src, nameStart, nameEnd, 'srcset')

      if (isSrc || isHref || isSrcset) {
        const t = Helpers.trimWs(src, valStart, valEnd)
        if (t.b > t.a) {
          if (isSrcset)
            Detection.parseSrcsetUrls(src, t.a, t.b, lineStarts, out)
          else
            Helpers.pushIfSingleLine(
              lineStarts,
              out,
              isSrc ? 'src' : 'href',
              t.a,
              t.b,
            )
        }
      }
    }

    i = tagEnd + 1
  }

  return out
}

export function findReferenceDefinitionUrls(src: string): RefDefUrlSpan[] {
  const lineStarts = Helpers.buildLineStarts(src)
  const out: RefDefUrlSpan[] = []

  for (let line = 0; line < lineStarts.length; line++) {
    const lineStart = lineStarts[line]
    const lineEnd =
      line + 1 < lineStarts.length ? lineStarts[line + 1] : src.length

    let i = lineStart
    let spaces = 0
    while (
      i < lineEnd &&
      src.charCodeAt(i) === CH_SPACE &&
      spaces < MAX_LEADING_SPACES
    ) {
      i++
      spaces++
    }

    if (i >= lineEnd || src.charCodeAt(i) !== CH_LBRACK) continue

    const labelEnd = Helpers.scanLabelEndOnLine(src, i, lineEnd)
    if (labelEnd < 0) continue
    if (labelEnd + 1 >= lineEnd || src.charCodeAt(labelEnd + 1) !== CH_COLON)
      continue

    i = labelEnd + 2
    i = Helpers.skipSep(src, i)

    const dest = Detection.parseRefDefDestination(src, i)
    if (!dest) continue

    const a = Helpers.indexToLineCol(lineStarts, dest.urlStart)
    const b = Helpers.indexToLineCol(lineStarts, dest.urlEnd)
    if (a.line !== b.line) continue

    out.push({ line: a.line, colStart: a.col, colEnd: b.col })
  }

  return out
}

export function checkLinkAttributes(from: number, content: string) {
  const endParen = content.indexOf(')', from)
  const nextChar = content.charCodeAt(endParen + 1)

  if (nextChar !== CH_LBRACE) {
    return
  }
  let end = endParen + 2
  while (end < content.length && content.charCodeAt(end) !== CH_RBRACE) {
    if (content.charCodeAt(end) === CH_BACKSLASH) {
      end++
    }
    end++
  }
  return parseAttrs(content.substring(endParen + 2, end))
}
