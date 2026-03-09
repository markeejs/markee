import type { Root } from 'hast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Rehype plugins searching for all code blocks marked as "prism" and
 * injecting the correct properties to the parent pre block
 * Goes in pair with remarkPrism()
 */
export function rehypePrism(): Transformer<Root, Root> {
  return (tree) =>
    visit(tree, 'element', (node, index, element) => {
      if (node.tagName === 'code' && node.properties?.prism) {
        if (node.properties.title && index !== undefined) {
          element?.children.splice(index, 0, {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['mk-prism-title'],
            },
            children: [
              { type: 'text', value: node.properties.title as string },
            ],
          })
          delete node.properties.title
        }

        ;(element as any).properties = JSON.parse(
          node.properties.prism as string,
        )
        delete node.properties.prism
      }
    })
}
