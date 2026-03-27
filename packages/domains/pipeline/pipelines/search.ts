import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

import { state } from '@markee/state'

import remarkGfm from 'remark-gfm'
import remarkEmoji from 'remark-gemoji'
import remarkParser from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkFrontMatter from 'remark-frontmatter'

import remarkRehype from 'remark-rehype'

import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'

import { remarkAttrs } from '../plugins/remark/attrs.js'
import { remarkTwemoji } from '../plugins/remark/twemoji.js'
import { remarkNestedHtml } from '../plugins/remark/nested-html.js'
import { remarkAbbreviations } from '../plugins/remark/abbreviations.js'
import { remarkAccessibleHeadings } from '../plugins/remark/accessible-headings.js'
import { remarkDirectiveRemoveLeaf } from '../plugins/remark/directive-remove-leaf.js'

import { remarkFontAwesome } from '../plugins/remark/fontawesome.js'
import { remarkMaterialIcons } from '../plugins/remark/material-icons.js'
import { remarkSimpleIcons } from '../plugins/remark/simple-icons.js'

const EXCLUDED_TAGS = [
  'script',
  'link',
  'img',
  'style',
  'input',
  'button',
  'textarea',
  'iframe',
  'embed',
]
const ALIASED_TAGS: Record<string, string> = {
  summary: 'div',
  details: 'div',
  a: 'span',
}

const searchUnifiedPipeline = unified()
const searchPipelineData = searchUnifiedPipeline.data()
searchPipelineData.pluginConfig = (plugin: string) => {
  const config = state.$config.get()
  return (config?.plugins as any)?.[plugin]
}

searchUnifiedPipeline
  .use(remarkParser)
  .use(remarkGfm)
  .use(remarkFrontMatter)
  .use(remarkDirective)
  .use(remarkDirectiveRemoveLeaf)
  .use(remarkNestedHtml)
  .use(() => (tree) => {
    // Clean up directive metadata
    visit(tree, 'paragraph', (paragraph: any) => {
      if ('data' in paragraph && paragraph.data.directiveLabel) {
        paragraph.children = []
      }
    })
  })
  .use(remarkFontAwesome)
  .use(remarkMaterialIcons)
  .use(remarkSimpleIcons)
  .use(remarkTwemoji.flagSupport)
  .use(remarkEmoji)
  .use(remarkTwemoji)
  .use(remarkAbbreviations)
  .use(remarkAttrs)
  .use(remarkAccessibleHeadings)
  .use(remarkRehype, {
    allowDangerousHtml: true,
  })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(() => (tree) => {
    visit(tree, 'element', (node: any, _, parent: any) => {
      if (EXCLUDED_TAGS.includes(node.tagName) && parent) {
        parent.children = parent.children.filter((e: any) => e !== node)
        return SKIP
      }
      if (ALIASED_TAGS[node.tagName]) {
        node.tagName = ALIASED_TAGS[node.tagName]
        delete node.properties.href
        delete node.properties.rel
        delete node.properties.target
      }
    })

    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'i') return
      delete node.properties?.className
      delete node.properties?.classNames
      delete node.properties?.style
    })
  })
  .use(rehypeStringify)

export function searchPipeline(content: string) {
  return searchUnifiedPipeline.processSync(content).toString()
}
