// @ts-expect-error - markdown-it exports are weird but this works
import { type Token } from 'markdown-it'
import parseAttrs from 'attributes-parser'
import {
  checkLinkAttributes,
  findHtmlAttrUrls,
  findInlineLinkAndImageUrls,
  findReferenceDefinitionUrls,
  keepOnlyCodeComments,
  keepOnlyHtmlComments,
  neutralizeRanges,
} from './helper-parse-inline.js'

export function retokenize(tokens: Token[], fileContent: string): Token[] {
  const lines = fileContent.split('\n')
  const gaps: [number, number][] = []
  let nextTokenLine = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.map && t.map[0] > nextTokenLine) {
      gaps.push([nextTokenLine, t.map[0] - 1])
    }
    if (t.map) nextTokenLine = t.map[1] + 1
  }
  if (nextTokenLine < lines.length) {
    gaps.push([nextTokenLine, lines.length])
  }

  let inTable = false
  let inHeading: any = null

  const rebaseLink = (
    link: {
      line: number
      colStart: number
      colEnd: number
    },
    token: { map: [number, number]; contentOffset: number[] },
    attrs: boolean = false,
  ) => ({
    url: lines[link.line + token.map[0]].slice(
      link.colStart + token.contentOffset[link.line],
      link.colEnd + token.contentOffset[link.line],
    ),
    line: link.line + token.map[0],
    start: link.colStart + token.contentOffset[link.line],
    end: link.colEnd + token.contentOffset[link.line],
    attrs: attrs
      ? checkLinkAttributes(
          link.colEnd + token.contentOffset[link.line],
          lines[link.line + token.map[0]],
        )
      : undefined,
  })

  return (
    [
      ...tokens,
      ...gaps
        .map((gap) => ({
          type: 'meta',
          map: gap,
          content: lines.slice(gap[0], gap[1]).join('\n'),
          contentOffset: lines.slice(gap[0], gap[1]).map(() => 0),
        }))
        .filter((t) => t.content.length > 0),
    ]
      // Collapse table
      .flatMap((t) => {
        if (t.type === 'table_open') {
          inTable = true
          return {
            type: 'inline',
            tag: 'table',
            map: t.map,
          }
        }
        if (t.type === 'table_close') {
          inTable = false
          return []
        }
        if (t.type === 'heading_open') {
          inHeading = t
        }
        if (t.type === 'heading_close') {
          inHeading = ''
        }
        if (
          inTable ||
          ['hr', 'paragraph_open', 'list_item_open', 'heading_open'].includes(
            t.type,
          ) ||
          t.type.endsWith('_close')
        ) {
          return []
        }
        if (t.type === 'inline' && inHeading) {
          return {
            ...t,
            tag: inHeading.tag,
            attrs: Object.fromEntries(inHeading.attrs ?? []),
            title: t.children.map((c: any) => c.content).join(''),
          }
        }
        if (t.type === 'fence') {
          const info = t.info.trim().split(' ')
          try {
            t.attrs = parseAttrs(info.slice(1).join(' '))
          } catch (err) {
            void err
            t.attrs = {}
          }
          t.lang = info[0]
        }

        return t
      })
      .map((t) => {
        // Resolve raw data
        if (t.map) {
          t.raw = lines.slice(t.map[0], t.map[1]).join('\n')
          t.content ??= t.raw
          const contentLines = t.content.split('\n')

          t.contentOffset = t.raw
            .split('\n')
            .map((line: string, index: number) =>
              line.indexOf(contentLines[index]),
            )
          t.text =
            t.children
              ?.map((c: any) => c.content)
              .join(' ')
              .replace(/ +/g, ' ') ?? ''

          if (t.type === 'fence') {
            const rawContent = t.raw.split('\n').slice(1, -1).join('\n')
            const contentLines = t.content.split('\n')
            t.contentOffset = rawContent
              .split('\n')
              .map((line: string, index: number) =>
                line.indexOf(contentLines[index]),
              )
          }
        }
        return t
      })
      .map((t, _, a) => {
        // Resolve meta content offset
        if (t.type === 'meta') {
          const matchingOpen = a.findLast(
            (i) =>
              i !== t && i.map && i.map[0] <= t.map[0] && i.map[1] >= t.map[1],
          )
          const matchingInline =
            matchingOpen &&
            a.find(
              (i) =>
                i.type === 'inline' &&
                i.map &&
                i.map[0] >= matchingOpen.map[0] &&
                i.map[1] <= matchingOpen.map[1],
            )

          if (matchingInline) {
            t.contentOffset = matchingInline.contentOffset[0]
            t.content = t.content
              .split('\n')
              .map((l: string) => l.slice(t.contentOffset))
              .join('\n')
          }
        }

        // Resolve directive content offset
        if (
          t.type === 'directive_container_open' ||
          t.type === 'directive_leaf'
        ) {
          if (t.type === 'directive_container_open') {
            const inline = a.filter(
              (i) =>
                i.type === 'inline' &&
                i.map[0] > t.map[0] &&
                i.map[1] < t.map[1],
            )
            t.content = inline.map((i) => i.content).join('')

            t.contentOffset = [
              lines[t.map[0]].indexOf(t.meta.fence),
              ...inline.flatMap((i) => i.contentOffset),
              lines[t.map[1] - 1].indexOf(t.meta.fence),
            ]
          } else {
            t.contentOffset = [lines[t.map[0]].indexOf(t.meta.fence)]
            t.content = t.raw.slice(t.contentOffset[0])
          }
        }

        // Resolve links offsets
        if (t.type === 'inline') {
          const neutralized = neutralizeRanges(t.content)
          t.links = [
            ...findInlineLinkAndImageUrls(neutralized).map((link) =>
              rebaseLink(link, t, true),
            ),
            ...findHtmlAttrUrls(t.content).map((link) => rebaseLink(link, t)),
          ]
        }

        if (t.type === 'fence') {
          let content = t.content
          if (['md', 'markdown', 'html'].includes(t.lang)) {
            content = keepOnlyHtmlComments(content)
          } else {
            content = keepOnlyCodeComments(content, t.lang?.toLowerCase())
          }
          t.links = findInlineLinkAndImageUrls(content).map((link) =>
            rebaseLink(link, { ...t, map: [t.map[0] + 1, t.map[1] - 1] }),
          )
        }

        if (t.type === 'meta') {
          t.links = findReferenceDefinitionUrls(t.content).map((link) =>
            rebaseLink(link, t),
          )
        }

        return t
      })
      .sort((a, b) => a.map[0] - b.map[0] || a.map[1] - b.map[1])
  )
}
