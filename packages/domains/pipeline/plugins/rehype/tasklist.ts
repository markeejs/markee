import type { Transformer } from 'unified'
import type { Root, Element } from 'hast'
import { visitParents } from 'unist-util-visit-parents'

/**
 * Rehype plugin to enable clickable checkboxes
 */
export const rehypeTasklist = (): Transformer<Root, Root> => (tree) => {
  visitParents(tree, 'element', (node, parents) => {
    const liParent = [...parents]
      .reverse()
      .find(
        (parent): parent is Element =>
          parent.type === 'element' && parent.tagName === 'li',
      )

    if (node.tagName === 'input' && liParent) {
      if (
        node.properties?.type === 'checkbox' &&
        (liParent.properties?.className as string[])?.includes('task-list-item')
      ) {
        node.properties.disabled = false
      }
    }
  })
}
