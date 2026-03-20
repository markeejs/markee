type IndentedSection = {
  preceding: string[]
  precedingLine: string | null
  startLine: number
  endLine: number
  lines: string[]
}

class DeprecatedAdmonitions {
  static infoRe = /(".*?"|'.*?'|\{.*?}|\S+)?/g

  static findIndentedSectionsWithPreceding(input: string): IndentedSection[] {
    const rawLines = input.split(/\r?\n/)

    const isBlankOrSpaces = (s: string) => /^[ \t]*$/.test(s)
    const isIndented4Spaces = (s: string) => /^(?: {4,})/.test(s)

    type FenceInfo = { ch: '`' | '~'; len: number }

    const parseFenceOpen = (line: string): FenceInfo | null => {
      const m = line.match(/^[ \t]*([`~]{3,})(.*)$/)
      if (!m) return null
      const run = m[1]
      const ch = run[0] as '`' | '~'
      for (let i = 1; i < run.length; i++) if (run[i] !== ch) return null
      return { ch, len: run.length }
    }

    const isFenceClose = (line: string, open: FenceInfo): boolean => {
      const m = line.match(/^[ \t]*([`~]{3,})[ \t]*$/)
      if (!m) return false
      const run = m[1]
      if (run[0] !== open.ch) return false
      for (let i = 1; i < run.length; i++) if (run[i] !== open.ch) return false
      return run.length >= open.len
    }

    const results: IndentedSection[] = []

    let carry: string[] = []
    let carryLastNonBlank: string | null = null
    let carryStartLine = 0

    let inGroup = false
    let groupStart = -1
    let groupEnd = -1
    let groupLines: string[] = []
    let groupPreceding: string[] = []
    let groupPrecedingLine: string | null = null

    const flushGroup = () => {
      if (!inGroup) return
      results.push({
        preceding: groupPreceding,
        precedingLine: groupPrecedingLine,
        startLine: groupStart,
        endLine: groupEnd,
        lines: groupLines,
      })

      inGroup = false
      groupStart = -1
      groupEnd = -1
      groupLines = []
      groupPreceding = []
      groupPrecedingLine = null

      carry = []
      carryLastNonBlank = null
      carryStartLine = groupEnd + 1
    }

    const fenceStack: FenceInfo[] = []

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]
      const blank = isBlankOrSpaces(line)
      const indented = isIndented4Spaces(line)

      if (inGroup) {
        if (indented || blank) {
          groupLines.push(line)
          groupEnd = i
        } else {
          flushGroup()
          carry.push(line)
          if (!blank) carryLastNonBlank = line
        }
        continue
      }

      if (fenceStack.length > 0) {
        const top = fenceStack[fenceStack.length - 1]
        if (isFenceClose(line, top)) {
          fenceStack.pop()
        } else {
          const maybeOpen = parseFenceOpen(line)
          if (maybeOpen) fenceStack.push(maybeOpen)
        }

        carry.push(line)
        if (!blank) carryLastNonBlank = line
        continue
      }

      if (!indented) {
        const maybeOpen = parseFenceOpen(line)
        if (maybeOpen) {
          fenceStack.push(maybeOpen)
          carry.push(line)
          if (!blank) carryLastNonBlank = line
          continue
        }
      }

      if (indented) {
        inGroup = true
        groupStart = i
        groupEnd = i
        groupLines = [line]

        groupPreceding = carry
        groupPrecedingLine = carryLastNonBlank
        continue
      }

      carry.push(line)
      if (!blank) carryLastNonBlank = line
    }

    flushGroup()

    if (carry.length > 0) {
      results.push({
        preceding: carry,
        precedingLine: carryLastNonBlank,
        startLine: carryStartLine,
        endLine: carryStartLine + carry.length - 1,
        lines: [],
      })
    }

    return results
  }

  static dedent(lines: string[]) {
    const minIndent = Math.min(
      ...lines.map((l) => (l.trim() ? l.search(/\S/) : Infinity)),
    )
    return lines
      .map((l) => l.slice(minIndent))
      .join('\n')
      .trim()
  }

  static extractInfo(line: string) {
    const candidates = line
      .match(this.infoRe)!
      .filter((p) => !!p)
      .map((value) => value.trim())
    let title = candidates.find((c) => c.startsWith('"') || c.startsWith("'"))
    const args = candidates.find((e) => e.startsWith('{'))
    const kind = candidates.find((e) => e !== title && e !== args)

    if (!title) {
      title = candidates.find((e) => e !== kind && e !== args)
    }

    return [
      kind ?? 'unknown',
      title?.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1') || '',
      args || '',
    ] as const
  }

  static extractPreceding(section: IndentedSection) {
    return section.preceding
      .slice(
        0,
        -(
          [...section.preceding]
            .reverse()
            .findIndex((l) => l === section.precedingLine) + 1
        ),
      )
      .join('\n')
  }

  static longestDirective(content: string) {
    const lines = content.split('\n')
    const longest = lines.reduce((acc, line) => {
      if (line.startsWith(':')) {
        return Math.max(acc, line.search(/[^:]/))
      }
      return acc
    }, 2)
    return ':'.repeat(longest)
  }

  static sanitizeArgs(args: string) {
    if (!args.trim().startsWith('{')) {
      return args.trim()
    }

    return `{${args.trim().slice(1, -1).trim()}}`
  }

  static convertAdmonition(content: string): string {
    const sections = this.findIndentedSectionsWithPreceding(content)
    const parts = sections.map((section) => {
      if (section.precedingLine?.trim().startsWith('!!!')) {
        const content = this.convertAdmonition(this.dedent(section.lines))
        const tag = `:${this.longestDirective(content)}`
        const [kind, title, args] = this.extractInfo(
          section.precedingLine.slice(3),
        )

        return `${this.extractPreceding(section)}
${tag}${kind}${title ? `[${title}]` : ''}${this.sanitizeArgs(args)}
${content}
${tag}
`
      } else if (section.precedingLine?.trim().startsWith('???')) {
        const content = this.convertAdmonition(this.dedent(section.lines))
        const tag = `:${this.longestDirective(content)}`
        const modifierAndInfo = section.precedingLine.slice(3)
        const modifier = modifierAndInfo.startsWith('+')
          ? '+'
          : modifierAndInfo.startsWith('-')
            ? '-'
            : null
        const info = modifier ? modifierAndInfo.slice(1) : modifierAndInfo
        let [kind, title, args] = this.extractInfo(info)

        if (!args) {
          args = '{}'
        }

        return `${this.extractPreceding(section)}
${tag}${kind}${title ? `[${title}]` : ''}${this.sanitizeArgs(args.replace('{', `{collapsed${modifier === '+' ? '="false"' : ''} `))}
${content}
${tag}
`
      } else if (section.precedingLine?.trim().startsWith('===')) {
        const content = this.convertAdmonition(this.dedent(section.lines))
        const tag = `:${this.longestDirective(content)}`
        const modifierAndInfo = section.precedingLine.slice(3)
        const modifier = modifierAndInfo.startsWith('!')
          ? '!'
          : modifierAndInfo.startsWith('?')
            ? '?'
            : null
        const info = modifier ? modifierAndInfo.slice(1) : modifierAndInfo
        let [kind, title, args] = this.extractInfo('tab ' + info)

        if (!args && modifier) {
          args = '{}'
        }

        return `${this.extractPreceding(section)}
${tag}${kind}${title ? `[${title}]` : ''}${this.sanitizeArgs(args.replace('{', `{${modifier === '!' ? 'linked' : ''}${modifier === '?' ? 'unlinked' : ''} `))}
${content}
${tag}
`
      } else if (section.precedingLine?.trim().startsWith('|||')) {
        const content = this.convertAdmonition(this.dedent(section.lines))
        const tag = `:${this.longestDirective(content)}`
        const [kind, title, args] = this.extractInfo(
          'div ' + section.precedingLine.slice(3),
        )

        return `${this.extractPreceding(section)}
${tag}${kind}${this.sanitizeArgs(args)}
${title}
${content}
${tag}
`
      } else {
        return [...section.preceding, ...section.lines].join('\n')
      }
    })
    return parts.join('\n')
  }
}

class DeprecatedFrontMatter {
  static convertImplicitFrontMatter(content: string) {
    // Check if document starts with an unmarked frontmatter
    const lines = content.split('\n')
    let idx = 0
    while (
      idx < lines.length &&
      lines[idx].trim() &&
      lines[idx].trim() !== '---'
    ) {
      idx += 1
    }
    type LineKind = 'frontmatter' | 'normal' | 'empty'

    const classify: LineKind[] = lines.slice(0, idx).map((line) => {
      if (line.trim().match(/^[0-9a-zA-Z_]+?:/)) return 'frontmatter'
      return 'normal'
    })
    classify.push('empty')
    classify.push('normal')

    const hasFrontMatter =
      classify.includes('frontmatter') &&
      classify.indexOf('frontmatter') < classify.indexOf('normal')

    if (hasFrontMatter) {
      const start = classify.indexOf('frontmatter')
      const end = start + classify.slice(start).indexOf('empty')
      lines.splice(start, 0, '---')
      lines.splice(end + 1, 0, '---')
      content = lines.join('\n')
    }

    return content
  }
}

export const DeprecationCompute = {
  convertDeprecatedSyntaxes(content: string) {
    return DeprecatedFrontMatter.convertImplicitFrontMatter(
      DeprecatedAdmonitions.convertAdmonition(content),
    )
  },
}
