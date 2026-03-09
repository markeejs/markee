import { visit } from 'unist-util-visit'
import type { Transformer } from 'unified'
import type { Root } from 'mdast'

/**
 * Remark plugins that finds all footnote definitions, then injects some dummy
 * footnote references at the start of the document to ensure the ordering of
 * the notes, as rehype-gfm orders them by _reference occurrence_ instead of
 * _definition occurrence_.
 */
export const remarkFootnoteOrdering = (): Transformer<Root, Root> => (tree) => {
  const order: string[] = []
  const referenced: string[] = []
  visit(tree, 'footnoteDefinition', (node) => {
    order.push(node.label as string)
  })
  visit(tree, 'footnoteReference', (node) => {
    referenced.push(node.identifier)
  })
  tree.children.unshift(
    ...order
      .filter((o) => referenced.includes(o))
      .map((o) => ({
        type: 'footnoteReference' as const,
        identifier: o,
        data: {
          hProperties: {
            dummy: 'true',
          },
        },
      })),
  )
}
