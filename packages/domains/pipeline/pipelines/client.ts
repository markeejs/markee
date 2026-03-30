import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

import remarkGfm from 'remark-gfm'
import remarkEmoji from 'remark-gemoji'
import remarkParser from 'remark-parse'
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
import { remarkTwemoji } from '../plugins/remark/twemoji.js'
import { remarkNestedHtml } from '../plugins/remark/nested-html.js'
import { remarkAccessibleHeadings } from '../plugins/remark/accessible-headings.js'
import { remarkHtmlEscapeSequences } from '../plugins/remark/html-escape-sequences.js'

import { withRehypeExtensions, withRemarkExtensions } from '../extensions.js'

export function ensureTitle(html: string, title?: string) {
  if (title && !html.match(/<h2.*<\/h2>/)) {
    return `<h2>${title}</h2>\n${html}`
  }
  return html
}

const emptyPlugin: Plugin<any[], any, any> = () => () => {}

type PipelinePlugin = Plugin<any[], any, any>

function hasDirectiveSyntax(content: string) {
  return content.includes('::')
}

function hasFootnoteSyntax(content: string) {
  return content.includes('[^')
}

function hasFencedCodeSyntax(content: string) {
  return content.includes('```') || content.includes('~~~')
}

function hasImageSyntax(content: string) {
  return content.includes('![') || content.includes('<img')
}

function hasAbbreviationSyntax(content: string) {
  return content.includes('*[')
}

function hasInsOrMarkSyntax(content: string) {
  return content.includes('++') || content.includes('==')
}

function hasTaskListSyntax(content: string) {
  return content.includes('[')
}

function hasTableMergeSyntax(content: string) {
  return (
    content.includes('|') && (content.includes('^') || content.includes('>'))
  )
}

async function loadOptionalPlugin(
  enabled: boolean,
  load: () => Promise<PipelinePlugin>,
): Promise<PipelinePlugin> {
  return enabled ? load() : emptyPlugin
}

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
    data.content = content
    const hasDirectives = hasDirectiveSyntax(content)
    const hasAbbreviations = hasAbbreviationSyntax(content)
    const hasFootnotes = hasFootnoteSyntax(content)
    const hasFencedCode = hasFencedCodeSyntax(content)
    const hasImages = hasImageSyntax(content)
    const hasInsOrMark = hasInsOrMarkSyntax(content)
    const hasTaskLists = hasTaskListSyntax(content)
    const hasTableMerge = hasTableMergeSyntax(content)

    const remarkDirectivePlugin = await loadOptionalPlugin(
      hasDirectives,
      async () => (await import('remark-directive')).default,
    )
    const remarkDirectiveRemoveLeafPlugin = await loadOptionalPlugin(
      hasDirectives,
      async () =>
        (await import('../plugins/remark/directive-remove-leaf.js'))
          .remarkDirectiveRemoveLeaf,
    )
    const remarkFootnoteOrderingPlugin = await loadOptionalPlugin(
      hasFootnotes,
      async () =>
        (await import('../plugins/remark/footnote-ordering.js'))
          .remarkFootnoteOrdering,
    )
    const remarkAdmonitionsPlugin = await loadOptionalPlugin(
      hasDirectives,
      async () =>
        (await import('../plugins/remark/admonitions.js')).remarkAdmonitions,
    )
    const remarkAbbreviationsPlugin = await loadOptionalPlugin(
      hasAbbreviations,
      async () =>
        (await import('../plugins/remark/abbreviations.js'))
          .remarkAbbreviations,
    )
    const remarkFontAwesomePlugin = await loadOptionalPlugin(
      content.includes(':fontawesome-') || content.includes(':fa-'),
      async () =>
        (await import('../plugins/remark/fontawesome.js')).remarkFontAwesome,
    )
    const remarkInsAndMarkPlugin = await loadOptionalPlugin(
      hasInsOrMark,
      async () =>
        (await import('../plugins/remark/ins-and-mark.js')).remarkInsAndMark,
    )
    const remarkMaterialIconsPlugin = await loadOptionalPlugin(
      content.includes(':material-'),
      async () =>
        (await import('../plugins/remark/material-icons.js'))
          .remarkMaterialIcons,
    )
    const remarkSimpleIconsPlugin = await loadOptionalPlugin(
      content.includes(':simple-'),
      async () =>
        (await import('../plugins/remark/simple-icons.js')).remarkSimpleIcons,
    )
    const remarkPrismPlugin = await loadOptionalPlugin(
      hasFencedCode,
      async () => (await import('../plugins/remark/prism.js')).remarkPrism,
    )
    const remarkLightboxPlugin = await loadOptionalPlugin(
      hasImages,
      async () =>
        (await import('../plugins/remark/lightbox.js')).remarkLightbox,
    )
    const rehypeFootnoteOrderingPlugin = await loadOptionalPlugin(
      hasFootnotes,
      async () =>
        (await import('../plugins/rehype/footnote-ordering.js'))
          .rehypeFootnoteOrdering,
    )
    const rehypePrismPlugin = await loadOptionalPlugin(
      hasFencedCode,
      async () => (await import('../plugins/rehype/prism.js')).rehypePrism,
    )
    const rehypeTableMergePlugin = await loadOptionalPlugin(
      hasTableMerge,
      async () =>
        (await import('../plugins/rehype/table-merge.js')).rehypeTableMerge,
    )
    const rehypeTasklistPlugin = await loadOptionalPlugin(
      hasTaskLists,
      async () =>
        (await import('../plugins/rehype/tasklist.js')).rehypeTasklist,
    )

    const baseMarkdownPipeline: any = (markdownProcessor as any)
      // Base Markdown
      .use(remarkParser)
      .use(remarkGfm)
      .use(remarkDirectivePlugin)
      .use(remarkDirectiveRemoveLeafPlugin)
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
      })

    let markdownPipeline: any = withRemarkExtensions(baseMarkdownPipeline)
    markdownPipeline = markdownPipeline
      // Advanced Markdown
      .use(remarkFootnoteOrderingPlugin)
      .use(title !== undefined ? remarkAccessibleHeadings : emptyPlugin)
      .use(remarkAdmonitionsPlugin)
      .use(remarkFrontMatter)
      .use(remarkFontAwesomePlugin)
      .use(remarkMaterialIconsPlugin)
      .use(remarkSimpleIconsPlugin)
      .use(remarkTwemoji.flagSupport)
      .use(remarkEmoji)
      .use(remarkTwemoji)
      .use(remarkAbbreviationsPlugin)
      .use(remarkAttrs)
      .use(remarkHtmlEscapeSequences)
      .use(remarkInsAndMarkPlugin)
      .use(remarkPrismPlugin)
      .use(remarkLightboxPlugin)

    const baseHtmlPipeline: any = (markdownPipeline as any)
      // Base HTML
      .use(remarkRehype, {
        allowDangerousHtml: true,
        handlers: defListHastHandlers,
      })
      .use(rehypeRaw)
      .use(rehypeSlug)

    let htmlPipeline: any = withRehypeExtensions(baseHtmlPipeline)
    htmlPipeline = htmlPipeline
      // Advanced HTML
      .use(rehypeFootnoteOrderingPlugin)
      .use(rehypePrismPlugin)
      .use(rehypeTableMergePlugin)
      .use(rehypeTasklistPlugin)
      .use(rehypeStringify)

    const html = String(await htmlPipeline.process(content))

    return ensureTitle(html, title)
  } catch (err) {
    console.log(err)
    return ''
  }
}
