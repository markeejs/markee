import type { Transformer } from 'unified'
import type { Root, Element } from 'hast'
import { visit } from 'unist-util-visit'
import { visitParents } from 'unist-util-visit-parents'

/**
 * Rehype plugins to handle column and row merges in tables
 */
export const rehypeTableMerge = (): Transformer<Root, Root> => (tree) => {
  visitParents(tree, 'element', (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1]
    const index = parent.children.indexOf(node)
    if (node.tagName === 'td') {
      if (node.children.length == 1 && node.children[0].type === 'text') {
        const content = node.children[0].value
        if (content.trim() === '>') {
          const merged = parent.children[index + 1]
          if (merged && merged.type === 'element') {
            merged.properties = {
              ...merged.properties,
              colSpan: Number(node.properties?.colSpan ?? 1) + 1,
            }
          }
        } else if (content.trim() !== '^') {
          // Check subsequent rows to see if we need to merge with a cell below
          const rowIndex = ancestors[ancestors.length - 2].children.indexOf(
            parent as Element,
          )
          const nextRows = ancestors[ancestors.length - 2].children.slice(
            rowIndex + 1,
          ) as Element[]
          const nextCells = nextRows.map((row) => row.children[index])
          const nextContent = nextCells.map((cell) =>
            cell && cell.type === 'element' && cell.children[0]?.type === 'text'
              ? cell.children[0].value
              : '',
          )

          let count = 0

          while (nextContent[0] === '^') {
            count += 1
            nextContent.shift()
          }

          if (count) {
            node.properties = {
              ...node.properties,
              rowSpan: count + 1,
            }
          }
        }
      }
    }
  })
  visit(tree, 'element', (node, index, parent) => {
    if (index !== undefined && parent && node.tagName === 'td') {
      if (node.children.length == 1 && node.children[0].type === 'text') {
        const content = node.children[0].value.trim()

        if (['^', '>'].includes(content)) {
          parent.children.splice(index, 1)
          return index
        }
      }
    }
  })
}
