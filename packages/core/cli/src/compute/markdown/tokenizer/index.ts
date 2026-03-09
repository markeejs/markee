import MarkdownIt from 'markdown-it'
import Attr from 'markdown-it-attrs'
import FM from 'markdown-it-front-matter'
import Directives from './plugin-directive.js'
import { retokenize } from './helper-retokenize.js'

const mdit = new MarkdownIt()
  .use(FM, () => {})
  .use(Attr)
  .use(Directives)

export type Token = {
  type: string
  title?: string
  text?: string
  meta?: any
  map: [number, number]
  lang?: string
  attrs?: Record<string, string>
  markup?: string
  tag?: string
  raw: string
  content: string
  contentOffset: number[]
  links?: {
    url: string
    line: number
    start: number
    end: number
    attrs?: { version?: 'latest' | 'fixed' }
  }[]
}

export class SimpleTokenizer {
  static tokenizeMarkdown(content: string) {
    return retokenize(mdit.parse(content, {}), content) as Token[]
  }
}
