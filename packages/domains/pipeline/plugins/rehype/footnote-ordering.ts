import { visit } from 'unist-util-visit'
import type { Transformer } from 'unified'
import type { Root } from 'hast'

/**
 * Rehype plugins that removes dummy footnotes used for ordering, and
 * fixes the content and heading depth for the default generated footnotes
 * Goes in pair with remarkFootnoteOrdering()
 */
export const rehypeFootnoteOrdering = (): Transformer<Root, Root> => (tree) => {
  visit(tree, 'element', (node, i, parent) => {
    if (i === undefined || !parent) {
      return
    }

    if (node.tagName === 'sup' && node.properties?.dummy) {
      parent.children.splice(i, 1)
      return i
    }

    if (node.tagName === 'h2' && node.properties?.id === 'footnote-label') {
      node.tagName = 'h3'
    }

    if (
      node.tagName === 'a' &&
      node.properties?.dataFootnoteBackref !== undefined
    ) {
      if (node.children.length === 1) {
        parent.children.splice(i, 1)
        return i
      } else if (node.children.length === 2) {
        node.children = [node.children[0]]
      }
    }
  })
}
