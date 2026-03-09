import type { Root } from 'mdast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Remark plugin for handling custom abbreviations syntax, detecting the abbreviations
 * and adding them around text nodes
 */
export function remarkAbbreviations(): Transformer<Root, Root> {
  return (tree) => {
    const abbreviations: Record<string, string | true> = {}

    // Extract abbreviations definitions
    visit(tree, 'paragraph', (node, index, parent) => {
      const hasAbbreviation = node.children?.some(
        (child) => child.type === 'text' && child.value.match(/\*\[.*?]:/),
      )
      if (hasAbbreviation) {
        const innerTexts: string[] = []
        visit(node, 'text', (sub) => innerTexts.push(sub.value))
        const innerText = innerTexts.join('')
        const lines = innerText.split('\n')
        lines.forEach((line) => {
          const [, key, value] = line.match(/\*\[(.*?)]:(.*)/) ?? ['', '', '']
          if (key) {
            abbreviations[key] = value || true
          }
        })

        if (parent && index !== undefined) {
          parent.children.splice(index, 1)
          return index
        }
      }
    })

    // Inject abbreviations in text
    visit(tree, 'text', (node, index, parent) => {
      let parts = [node.value]
      Object.keys(abbreviations).forEach((key) => {
        parts = parts.flatMap((part) =>
          part
            .split(key)
            .flatMap((p, i) => (i ? [key, p] : [p]))
            .filter(Boolean),
        )
      })
      if (parts.length > 1 && parent && index !== undefined) {
        const children = parts.map((part) => {
          if (abbreviations[part]) {
            return {
              type: 'strong' as const,
              data: {
                hName: 'abbr',
                hProperties: {
                  title: abbreviations[part],
                },
              },
              children: [{ type: 'text' as const, value: part }],
            }
          }
          return { type: 'text', value: part } as const
        })
        parent.children.splice(index, 1, ...children)
      }
    })
  }
}
