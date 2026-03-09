// @ts-expect-error - markdown-it exports are weird but this works
import MarkdownIt, { type StateBlock } from 'markdown-it'
import parseAttrs from 'attributes-parser'

export type DirectivePluginOptions = {
  allowLeadingSpaces?: number
}

type DirectiveMeta = {
  kind: 'container' | 'leaf'
  name: string
  label?: string
  rawAttrs?: string
  fence?: string
}

function isWs(ch: number) {
  return ch === 0x20 || ch === 0x09
}

function skipWs(src: string, i: number, end: number) {
  while (i < end && isWs(src.charCodeAt(i))) i++
  return i
}

function parseName(
  src: string,
  i: number,
  end: number,
): { name: string; next: number } | null {
  if (i >= end) return null
  const c0 = src.charCodeAt(i)
  const isStart =
    (c0 >= 0x41 && c0 <= 0x5a) || (c0 >= 0x61 && c0 <= 0x7a) || c0 === 0x5f
  if (!isStart) return null

  let j = i + 1
  while (j < end) {
    const c = src.charCodeAt(j)
    const ok =
      (c >= 0x41 && c <= 0x5a) ||
      (c >= 0x61 && c <= 0x7a) ||
      (c >= 0x30 && c <= 0x39) ||
      c === 0x5f ||
      c === 0x2d
    if (!ok) break
    j++
  }

  const last = src.charCodeAt(j - 1)
  if (last === 0x2d || last === 0x5f) return null

  return { name: src.slice(i, j), next: j }
}

function parseBracketLabelSameLine(
  src: string,
  openBracket: number,
  lineEnd: number,
) {
  if (src.charCodeAt(openBracket) !== 0x5b) return null // '['

  let i = openBracket + 1
  let depth = 1

  while (i < lineEnd) {
    const ch = src.charCodeAt(i)

    if (ch === 0x5c /* \ */) {
      i += i + 1 < lineEnd ? 2 : 1
      continue
    }

    if (ch === 0x5b /* [ */) {
      depth++
      i++
      continue
    }

    if (ch === 0x5d /* ] */) {
      depth--
      if (depth === 0) {
        return { labelStart: openBracket + 1, labelEnd: i, next: i + 1 }
      }
      i++
      continue
    }

    i++
  }

  return null
}

function parseAttrsSameLine(src: string, openBrace: number, lineEnd: number) {
  if (src.charCodeAt(openBrace) !== 0x7b) return null // '{'

  let i = openBrace
  let depth = 0
  let quote: 0 | 0x22 | 0x27 = 0
  let esc = false

  while (i < lineEnd) {
    const ch = src.charCodeAt(i)

    if (esc) {
      esc = false
      i++
      continue
    }

    if (ch === 0x5c /* \ */) {
      esc = true
      i++
      continue
    }

    if (quote) {
      if (ch === quote) quote = 0
      i++
      continue
    }

    if (ch === 0x22 /* " */ || ch === 0x27 /* ' */) {
      quote = ch as any
      i++
      continue
    }

    if (ch === 0x7b /* { */) {
      depth++
      i++
      continue
    }

    if (ch === 0x7d /* } */) {
      depth--
      i++
      if (depth === 0) return { attrsStart: openBrace, attrsEnd: i, next: i }
      continue
    }

    i++
  }

  return null
}

function readFence(src: string, pos: number, lineEnd: number) {
  const ch = src.charCodeAt(pos)
  if (ch !== 0x3a) return null // ':'
  let i = pos
  while (i < lineEnd && src.charCodeAt(i) === 0x3a) i++
  const count = i - pos
  if (count < 2) return null
  return { fence: src.slice(pos, i), count, next: i }
}

function directiveContainerRule(
  opts: Required<DirectivePluginOptions>,
  md: MarkdownIt,
) {
  return (
    state: StateBlock,
    startLine: number,
    endLine: number,
    silent: boolean,
  ) => {
    const lineStart = state.bMarks[startLine] + state.tShift[startLine]
    const lineEnd = state.eMarks[startLine]
    const indent = state.sCount[startLine]

    if (indent - state.blkIndent > opts.allowLeadingSpaces) return false

    const fenceRes = readFence(state.src, lineStart, lineEnd)
    if (!fenceRes || fenceRes.count < 3) return false

    let pos = fenceRes.next

    // no whitespace allowed between fence and name
    const nameRes = parseName(state.src, pos, lineEnd)
    if (!nameRes) return false
    pos = nameRes.next

    // no trailing colons on opening line (:::a::: is invalid)
    if (pos < lineEnd && state.src.charCodeAt(pos) === 0x3a) return false

    let label: string | undefined
    let rawAttrs: string | undefined

    if (pos < lineEnd && state.src.charCodeAt(pos) === 0x5b) {
      const lab = parseBracketLabelSameLine(state.src, pos, lineEnd)
      if (!lab) return false
      label = state.src.slice(lab.labelStart, lab.labelEnd)
      pos = lab.next
    }

    if (pos < lineEnd && state.src.charCodeAt(pos) === 0x7b) {
      const at = parseAttrsSameLine(state.src, pos, lineEnd)
      if (!at) return false
      rawAttrs = state.src.slice(at.attrsStart + 1, at.attrsEnd - 1)
      pos = at.next
    }

    // nothing else allowed except whitespace
    pos = skipWs(state.src, pos, lineEnd)
    if (pos !== lineEnd) return false

    if (silent) return true

    const openCount = fenceRes.count
    let nextLine = startLine + 1
    let foundClose = false
    let closeLine = endLine

    while (nextLine < endLine) {
      const s = state.bMarks[nextLine] + state.tShift[nextLine]
      const e = state.eMarks[nextLine]
      if (state.isEmpty(nextLine)) {
        nextLine++
        continue
      }

      const li = state.sCount[nextLine]
      if (li < state.blkIndent) break

      const closeFence = readFence(state.src, s, e)
      if (closeFence && closeFence.count >= openCount) {
        let p = closeFence.next
        p = skipWs(state.src, p, e)
        if (p === e) {
          foundClose = true
          closeLine = nextLine
          break
        }
      }

      nextLine++
    }

    // mimic micromark: if no closing, run to end of parent container
    const contentEndLine = foundClose ? closeLine : endLine

    const open = state.push('directive_container_open', 'div', 1)
    open.block = true
    open.map = [startLine, contentEndLine + 1]
    ;(open.meta ??= {}) as any
    Object.assign(open.meta as DirectiveMeta, {
      kind: 'container',
      name: nameRes.name,
      label,
      fence: fenceRes.fence,
    })
    Object.assign(open, { attrs: rawAttrs ? parseAttrs(rawAttrs) : null })

    const oldParentType = state.parentType
    const oldLineMax = state.lineMax
    state.parentType = 'container'
    state.lineMax = contentEndLine

    md.block.tokenize(state, startLine + 1, contentEndLine)

    state.parentType = oldParentType
    state.lineMax = oldLineMax

    state.line = foundClose ? contentEndLine + 1 : contentEndLine
    return true
  }
}

function directiveLeafRule(opts: Required<DirectivePluginOptions>) {
  return (
    state: StateBlock,
    startLine: number,
    _endLine: number,
    silent: boolean,
  ) => {
    const lineStart = state.bMarks[startLine] + state.tShift[startLine]
    const lineEnd = state.eMarks[startLine]
    const indent = state.sCount[startLine]

    if (indent - state.blkIndent > opts.allowLeadingSpaces) return false

    const fenceRes = readFence(state.src, lineStart, lineEnd)
    if (!fenceRes || fenceRes.count !== 2) return false

    let pos = fenceRes.next

    // no whitespace allowed between fence and name
    const nameRes = parseName(state.src, pos, lineEnd)
    if (!nameRes) return false
    pos = nameRes.next

    // no trailing colons after name for leaf either (keeps it consistent)
    if (pos < lineEnd && state.src.charCodeAt(pos) === 0x3a) return false

    let label: string | undefined
    let rawAttrs: string | undefined

    if (pos < lineEnd && state.src.charCodeAt(pos) === 0x5b) {
      const lab = parseBracketLabelSameLine(state.src, pos, lineEnd)
      if (!lab) return false
      label = state.src.slice(lab.labelStart, lab.labelEnd)
      pos = lab.next
    }

    if (pos < lineEnd && state.src.charCodeAt(pos) === 0x7b) {
      const at = parseAttrsSameLine(state.src, pos, lineEnd)
      if (!at) return false
      rawAttrs = state.src.slice(at.attrsStart + 1, at.attrsEnd - 1)
      pos = at.next
    }

    pos = skipWs(state.src, pos, lineEnd)
    if (pos !== lineEnd) return false

    if (silent) return true

    const tok = state.push('directive_leaf', '', 0)
    tok.block = true
    tok.map = [startLine, startLine + 1]
    tok.markup = fenceRes.fence
    ;(tok.meta ??= {}) as any
    Object.assign(tok.meta as DirectiveMeta, {
      kind: 'leaf',
      name: nameRes.name,
      label,
      fence: fenceRes.fence,
    })
    Object.assign(tok, { attrs: rawAttrs ? parseAttrs(rawAttrs) : null })

    state.line = startLine + 1
    return true
  }
}

export default function directivePlugin(
  md: MarkdownIt,
  options: DirectivePluginOptions = {},
) {
  const opts: Required<DirectivePluginOptions> = {
    allowLeadingSpaces: options.allowLeadingSpaces ?? 3,
  }

  md.block.ruler.before(
    'fence',
    'directive_container',
    directiveContainerRule(opts, md),
    {
      alt: ['paragraph', 'reference', 'blockquote', 'list'],
    },
  )

  md.block.ruler.before(
    'paragraph',
    'directive_leaf',
    directiveLeafRule(opts),
    {
      alt: ['paragraph', 'reference', 'blockquote', 'list'],
    },
  )
}
