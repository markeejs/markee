import { visit } from 'unist-util-visit'
import type { Transformer } from 'unified'
import type { Root } from 'mdast'

/**
 * Remark plugin that finds all HTML escape sequences (&...;) in text nodes and replace
 * them by HTML nodes so they correctly render.
 */
export const remarkHtmlEscapeSequences =
  (): Transformer<Root, Root> => (tree) => {
    visit(tree, 'text', (element, index, parent) => {
      const parts = element.value.split(/(&[^;\s]*?;)/g)

      if (parts.length > 1 && index !== undefined && parent) {
        parent.children.splice(
          index,
          1,
          ...parts.map((part, idx) => {
            if (idx % 2) {
              return { type: 'html' as const, value: part }
            }
            return { type: 'text' as const, value: part }
          }),
        )
        return index
      }
    })
  }
