import type { Root } from 'mdast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

import { brands, regular, solid } from '../resources/fontawesome-definition.js'

/**
 * Remark plugins for converting :fontawesome-{icon}: syntax into the corresponding
 * fontawesome icon
 */
export function remarkFontAwesome(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      const faRe = /:fontawesome-([\w-]+):/g
      if (node.value.match(faRe) && parent && index !== undefined) {
        const textNodes = node.value.split(faRe).map((value, i) => {
          if (i % 2) {
            const icon = value
            let type = 'solid'
            let key = icon
            if (icon.startsWith('brands-')) {
              type = 'brands'
              key = icon.slice('brands-'.length)
            } else if (icon.startsWith('regular-')) {
              type = 'regular'
              key = icon.slice('regular-'.length)
            } else if (icon.startsWith('solid-')) {
              type = 'solid'
              key = icon.slice('solid-'.length)
            } else if (solid.includes(icon)) {
              type = 'solid'
            } else if (regular.includes(icon)) {
              type = 'regular'
            } else if (brands.includes(icon)) {
              type = 'brands'
            }

            return {
              type: 'text',
              value: '',
              data: {
                hName: 'i',
                hProperties: {
                  className: ['fa-fontawesome', `fa-${type}`, `fa-${key}`],
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
