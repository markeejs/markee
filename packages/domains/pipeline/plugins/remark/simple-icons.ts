import type { Root } from 'mdast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Remark plugins for converting :simple-{icon}: syntax into the corresponding
 * simple-icons icon
 */
export function remarkSimpleIcons(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      const faRe = /:simple-([\w-]+):/g
      if (node.value.match(faRe) && parent && index !== undefined) {
        const textNodes = node.value.split(faRe).map((value, i) => {
          if (i % 2) {
            return {
              type: 'text',
              value: '',
              data: {
                hName: 'i',
                hProperties: {
                  className: ['si', `si-${value}`],
                },
              },
            } as const
          }

          return {
            type: 'text',
            value,
          } as const
        })

        parent.children.splice(index, 1, ...textNodes)
      }
    })
  }
}
