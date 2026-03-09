import type { Root } from 'mdast'
import { SKIP, visit } from 'unist-util-visit'
import { unified, type Transformer } from 'unified'

import dedent from 'dedent'
import remarkGfm from 'remark-gfm'
import remarkParser from 'remark-parse'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'

const UNTOUCHED_NODES = [
  'style',
  'script',
  'img',
  'br',
  'hr',
  'code',
  'input',
  'iframe',
  'svg',
]

/**
 * Remark plugin that uses Rehype internally to allow deep nesting of Markdown
 * inside HTML nodes, for as many level as wanted
 */
export function remarkNestedHtml(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'html', (node, index, parent) => {
      // Only treat HTML fragments that actually contains at least one opening tag and one closing tag
      // This ignores the following nodes
      // - HTML comments
      // - Isolated opening tags used by Markdown for inline HTML
      // - Isolated closing tags used by Markdown for inline HTML
      // - Void elements
      if (
        ((node.value.match(/<[^/!]([^>])*?>/) &&
          !node.value.match(/<\/([^>])*?>/)) ||
          (!node.value.match(/<[^/!]([^>])*?>/) &&
            node.value.match(/<\/([^>])*?>/))) &&
        !node.value.match(/\/>/) &&
        !node.value.match(
          /<(hr|br|area|base|col|embed|img|input|source|track|wbr)>/,
        )
      ) {
        return
      }

      const htmlAst = unified()
        .use(rehypeParse, { fragment: true })
        .parse(node.value) as any

      if (
        htmlAst.children.length === 1 &&
        htmlAst.children[0].type === 'comment'
      ) {
        return
      }

      htmlAst.children = htmlAst.children?.map((child: any) => {
        if (
          child.type === 'text' &&
          !UNTOUCHED_NODES.includes(htmlAst.tagName)
        ) {
          return unified()
            .use(remarkGfm)
            .use(remarkParser)
            .parse(dedent(child.value))
        }

        return child
      })

      visit(htmlAst, 'element', (element) => {
        if (
          UNTOUCHED_NODES.includes(element.tagName) ||
          'dataPristine' in element.properties
        ) {
          return SKIP
        }

        const hasText = element.children.some((child: any) => {
          return child.type === 'text' && !!child.value?.trim()
        })

        if (hasText) {
          const content = unified()
            .use(rehypeStringify)
            .stringify({ ...element, type: 'root' })
          const mdAst = unified()
            .use(remarkGfm)
            .use(remarkParser)
            .parse(dedent(content))
          if (
            mdAst.children.length === 1 &&
            mdAst.children[0]?.type === 'paragraph'
          ) {
            element.children = mdAst.children[0].children
          } else {
            element.children = mdAst.children
          }
        }
      })

      visit(htmlAst, 'element', (node) => {
        node.data = {
          hName: node.tagName,
          hProperties: node.properties,
        }
      })

      visit(htmlAst, 'comment', (node) => {
        node.type = 'html'
        node.value = '<!--' + node.value + '-->'
      })

      parent?.children.splice(index as number, 1, htmlAst)

      return index
    })
  }
}
