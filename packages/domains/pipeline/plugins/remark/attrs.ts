import { visit } from 'unist-util-visit'
import { visitParents } from 'unist-util-visit-parents'
import type { Transformer } from 'unified'
import type { Root, Text } from 'mdast'

import { parseAttributes } from '../../helpers/attrs.js'

const inlineTargetRe = /^\{(.*?)}/
const blockTargetRe = /\n\{(.*?)}$/
const genericRe = /\{(.*?)}$/
const spanRe = /(\[.*?]\{.*?})/g
const spanAfterBlockRe = /^[^[]*?(]\{.*?})/
const spanBeforeBlockRe = /\[[^\]]*$/
const spanContentRe = /\[(.*?)]\{(.*?)}/
const attrsContainerRe = /]\{(.*?)}/

/**
 * Function used to ignore a node if it's an admonition title or content wrapper
 * @param candidate - candidate to check
 * @returns - whether to skip or not
 */
function skipAdmonitionContent(candidate: any) {
  return (
    !candidate.data?.hProperties?.className?.includes('mk-admonition-title') &&
    !candidate.data?.hProperties?.className?.includes('mk-admonition-content')
  )
}

/**
 * Remark plugin for handling custom attributes syntax around Markdown nodes
 */
export function remarkAttrs(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      // Detect special span syntax : [content]{ ...attrs }
      if (node.value.match(spanRe) && parent && index !== undefined) {
        const replacement = node.value.split(spanRe).map((entry, index) => {
          if (index % 2) {
            const [, content, attrs] = entry.match(spanContentRe) ?? [
              '',
              '',
              '',
            ]
            return {
              type: 'span' as 'strong',
              data: {
                hName: 'span',
                hProperties: {
                  ...parseAttributes(attrs, {}),
                },
              },
              children: [{ type: 'text' as const, value: content }],
            }
          }

          return { type: 'text' as const, value: entry }
        })

        parent.children.splice(index, 1, ...replacement)
        return index
      }
      // Detect when a block is surrounded with span syntax: [**content**]{ ...attrs }
      else if (
        node.value.match(spanAfterBlockRe) &&
        parent &&
        index !== undefined
      ) {
        // Check if block was preceded by a [
        const preceding = parent.children
          .slice(0, index)
          .reverse()
          .find(
            (block) =>
              block.type === 'text' &&
              block.value.trimStart().match(spanBeforeBlockRe),
          ) as Text
        const start = parent.children.indexOf(preceding as any)
        const content = parent.children.slice(start + 1, index)
        const attrs = node.value.match(attrsContainerRe)?.[1] ?? ''

        if (!preceding) {
          return
        }

        const prefix = preceding.value.split('[').pop() || ''
        const suffix = node.value.split(']')[0]

        if (prefix) {
          content.unshift({ type: 'text', value: prefix })
        }
        if (suffix) {
          content.push({ type: 'text', value: suffix })
        }

        const block = {
          type: 'span' as 'strong',
          data: {
            hName: 'span',
            hProperties: {
              ...parseAttributes(attrs, {}),
            },
          },
          children: content,
        }

        preceding.value = preceding.value.slice(0, -1 - prefix?.length)
        node.value = node.value.replace(spanAfterBlockRe, '')
        parent.children.splice(start + 1, content.length, block as any)
        return start + 1
      }
      // Detect for inlines: bold, italic, links, images...
      else if (
        node.value.match(inlineTargetRe) &&
        parent &&
        index !== undefined
      ) {
        const target = parent.children[index - 1]

        if (target) {
          const attrs = node.value.match(inlineTargetRe)?.[1] ?? ''
          target.data = {
            ...target.data,
            hProperties: parseAttributes(
              attrs,
              (target.data?.hProperties ?? {}) as Record<string, any>,
            ),
          }

          node.value = node.value.replace(inlineTargetRe, '')
        }
      }
    })

    visitParents(tree, 'text', (node, ancestors) => {
      // Detect for blocks: paragraphs, lists, quotes...
      if (node.value.match(blockTargetRe)) {
        const rootAncestor = ancestors.at(-1)
        if (rootAncestor) {
          const attrs = node.value.match(blockTargetRe)?.[1] ?? ''
          rootAncestor.data = {
            ...rootAncestor.data,
            hProperties: parseAttributes(
              attrs,
              (rootAncestor.data?.hProperties ?? {}) as Record<string, any>,
            ),
          }

          node.value = node.value.replace(blockTargetRe, '')
        }
      }
      // Detect remaining cases: tables, titles...
      else if (node.value.match(genericRe)) {
        let rootAncestor =
          ancestors
            .slice(1)
            .reverse()
            .find((ancestor) => {
              const isCandidate =
                ancestor.type !== 'paragraph' || ancestor.data?.hName
              if (isCandidate) {
                return skipAdmonitionContent(ancestor)
              }
              return false
            }) ?? ancestors[1]

        // If this is not a paragraph, or an hName is set, we are dealing with a custom block, we should append the attributes
        if (rootAncestor.data?.hName || rootAncestor.type !== 'paragraph') {
          if (rootAncestor.type === 'tableCell') {
            const parent = ancestors[ancestors.indexOf(rootAncestor) - 1]
            const columnCount = (
              ancestors[ancestors.indexOf(rootAncestor) - 2].children[0] as any
            ).children.length
            if (
              parent &&
              parent.children.indexOf(rootAncestor as any) == columnCount
            ) {
              rootAncestor = parent
            } else if (
              parent &&
              parent.children.indexOf(rootAncestor as any) > columnCount
            ) {
              rootAncestor = ancestors[ancestors.indexOf(rootAncestor) - 2]
            }
          }

          const attrs = node.value.match(genericRe)?.[1] ?? ''
          rootAncestor.data = {
            ...rootAncestor.data,
            hProperties: parseAttributes(
              attrs,
              (rootAncestor.data?.hProperties ?? {}) as Record<string, any>,
            ),
          }

          node.value = node.value.replace(genericRe, '')
        }
        // If it's not an hName, it might be a title
        else {
          const target =
            ancestors[0].children[
              ancestors[0].children?.indexOf(rootAncestor as any) - 1
            ]
          if (target && ['heading', 'code'].includes(target.type)) {
            const attrs = node.value.match(genericRe)?.[1] ?? ''
            target.data = {
              ...target.data,
              hProperties: parseAttributes(
                attrs,
                (target.data?.hProperties ?? {}) as Record<string, any>,
              ),
            }

            node.value = node.value.replace(genericRe, '')
          }
        }
      }
    })
  }
}
