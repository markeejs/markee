import type { Data, Processor } from 'unified'

import { mdastGenericTag } from './generic-tags/mdast.js'
import { micromarkGenericTag } from './generic-tags/micromark.js'

type GenericTagProcessorData = Data & {
  micromarkExtensions?: any[]
  fromMarkdownExtensions?: any[]
  toMarkdownExtensions?: any[]
}

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

  const data = this.data() as GenericTagProcessorData

  const micromarkExtensions =
    data.micromarkExtensions || (data.micromarkExtensions = [])
  const fromMarkdownExtensions =
    data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])
  const toMarkdownExtensions =
    data.toMarkdownExtensions || (data.toMarkdownExtensions = [])

  micromarkExtensions.push(micromarkIns)
  fromMarkdownExtensions.push(mdastIns.genericTagFromMarkdown())
  toMarkdownExtensions.push(mdastIns.genericTagToMarkdown())

  micromarkExtensions.push(micromarkMark)
  fromMarkdownExtensions.push(mdastMark.genericTagFromMarkdown())
  toMarkdownExtensions.push(mdastMark.genericTagToMarkdown())
}
