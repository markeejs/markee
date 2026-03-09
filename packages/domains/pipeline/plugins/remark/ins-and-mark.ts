import type { Processor } from 'unified'

import { mdastGenericTag } from './generic-tags/mdast.js'
import { micromarkGenericTag } from './generic-tags/micromark.js'

export function remarkInsAndMark(this: Processor) {
  const mdastIns = mdastGenericTag({
    name: 'ins',
    character: '+',
  })
  const micromarkIns = micromarkGenericTag({
    name: 'ins',
    character: 'plusSign',
  })
  const mdastMark = mdastGenericTag({
    name: 'mark',
    character: '=',
  })
  const micromarkMark = micromarkGenericTag({
    name: 'mark',
    character: 'equalsTo',
  })

  const data = this.data()

  const micromarkExtensions =
    (data.micromarkExtensions as any[]) || (data.micromarkExtensions = [])
  const fromMarkdownExtensions =
    (data.fromMarkdownExtensions as any[]) || (data.fromMarkdownExtensions = [])
  const toMarkdownExtensions =
    ((data as any).toMarkdownExtensions as any[]) ||
    ((data as any).toMarkdownExtensions = [])

  micromarkExtensions.push(micromarkIns)
  fromMarkdownExtensions.push(mdastIns.genericTagFromMarkdown())
  toMarkdownExtensions.push(mdastIns.genericTagToMarkdown())

  micromarkExtensions.push(micromarkMark)
  fromMarkdownExtensions.push(mdastMark.genericTagFromMarkdown())
  toMarkdownExtensions.push(mdastMark.genericTagToMarkdown())
}
