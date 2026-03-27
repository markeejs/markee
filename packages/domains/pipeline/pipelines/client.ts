import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'

import remarkGfm from 'remark-gfm'
import remarkEmoji from 'remark-gemoji'
import remarkParser from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkFrontMatter from 'remark-frontmatter'
import {
  remarkDefinitionList,
  defListHastHandlers,
} from 'remark-definition-list'

import remarkRehype from 'remark-rehype'

import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'

import parseAttrs from 'attributes-parser'

import { state } from '@markee/state'

import { remarkAttrs } from '../plugins/remark/attrs.js'
import { remarkPrism } from '../plugins/remark/prism.js'
import { remarkTwemoji } from '../plugins/remark/twemoji.js'
import { remarkLightbox } from '../plugins/remark/lightbox.js'
import { remarkNestedHtml } from '../plugins/remark/nested-html.js'
import { remarkAdmonitions } from '../plugins/remark/admonitions.js'
import { remarkInsAndMark } from '../plugins/remark/ins-and-mark.js'
import { remarkAbbreviations } from '../plugins/remark/abbreviations.js'
import { remarkFootnoteOrdering } from '../plugins/remark/footnote-ordering.js'
import { remarkAccessibleHeadings } from '../plugins/remark/accessible-headings.js'
import { remarkHtmlEscapeSequences } from '../plugins/remark/html-escape-sequences.js'
import { remarkDirectiveRemoveLeaf } from '../plugins/remark/directive-remove-leaf.js'

import { rehypePrism } from '../plugins/rehype/prism.js'
import { rehypeTasklist } from '../plugins/rehype/tasklist.js'
import { rehypeTableMerge } from '../plugins/rehype/table-merge.js'
import { rehypeFootnoteOrdering } from '../plugins/rehype/footnote-ordering.js'

import { remarkFontAwesome } from '../plugins/remark/fontawesome.js'
import { remarkMaterialIcons } from '../plugins/remark/material-icons.js'
import { remarkSimpleIcons } from '../plugins/remark/simple-icons.js'

import { withRehypeExtensions, withRemarkExtensions } from '../extensions.js'

export function ensureTitle(html: string, title?: string) {
  if (title && !html.match(/<h2.*<\/h2>/)) {
    return `<h2>${title}</h2>\n${html}`
  }
  return html
}

const emptyPlugin = () => () => {}
export async function clientPipeline(
  content: string,
  title: string | undefined,
  key: string,
) {
  const file = state.$navigation.get().files[key]
  void import('../plugins/styles/index.js')

  try {
    const config = state.$config.get()
    const frontMatter = file?.frontMatter ?? {}
    const pluginConfig = (plugin: string) => {
      const fromConfig = (config?.plugins as any)?.[plugin]
      const fromFrontMatter = (frontMatter?.plugins as any)?.[plugin]
      return fromFrontMatter ?? fromConfig
    }

    const markdownProcessor = unified()
    const data = markdownProcessor.data()
    data.config = config
    data.frontMatter = frontMatter
    data.pluginConfig = pluginConfig

    const markdownPipeline = withRemarkExtensions(
      markdownProcessor
        // Base Markdown
        .use(remarkParser)
        .use(remarkGfm)
        .use(remarkDirective)
        .use(remarkDirectiveRemoveLeaf)
        .use(remarkDefinitionList)
        .use(remarkNestedHtml)
        .use(() => (tree: Root) => {
          visit(tree, 'code', (node) => {
            const attrs = parseAttrs(node.meta ?? '')
            node.data = {
              ...node.data,
              hProperties: {
                ...(node.data?.hProperties as any),
                ...attrs,
              },
            }
          })
        }),
    )
      // Advanced Markdown
      .use(remarkFootnoteOrdering)
      .use(title !== undefined ? remarkAccessibleHeadings : emptyPlugin)
      .use(remarkAdmonitions)
      .use(remarkFrontMatter)
      .use(remarkFontAwesome)
      .use(remarkMaterialIcons)
      .use(remarkSimpleIcons)
      .use(remarkTwemoji.flagSupport)
      .use(remarkEmoji)
      .use(remarkTwemoji)
      .use(remarkAbbreviations)
      .use(remarkAttrs)
      .use(remarkHtmlEscapeSequences)
      .use(remarkInsAndMark)
      .use(remarkPrism)
      .use(remarkLightbox)

    const htmlPipeline = withRehypeExtensions(
      markdownPipeline
        // Base HTML
        .use(remarkRehype, {
          allowDangerousHtml: true,
          handlers: defListHastHandlers,
        })
        .use(rehypeRaw)
        .use(rehypeSlug),
    )
      // Advanced HTML
      .use(rehypeFootnoteOrdering)
      .use(rehypePrism)
      .use(rehypeTableMerge)
      .use(rehypeTasklist)
      .use(rehypeStringify)

    const html = String(await htmlPipeline.process(content))

    return ensureTitle(html, title)
  } catch (err) {
    console.log(err)
    return ''
  }
}
