import type { Transformer } from 'unified'
import type { Root, Strong } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Remark plugin for increasing the depth of headers to start at 2 instead of 1
 */
export function remarkAccessibleHeadings(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'heading', (node) => {
      node.depth += 1
      if (node.depth > 6) {
        const strong = node as unknown as Strong
        strong.type = 'strong'
        strong.data = { hProperties: { role: 'heading' } }
      }
    })
  }
}
