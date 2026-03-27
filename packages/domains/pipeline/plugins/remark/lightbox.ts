import type { Root } from 'mdast'
import type { Processor, Transformer } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Remark plugin to wrap images into a lightbox link, except if opted out
 */
export function remarkLightbox(this: Processor): Transformer<Root, Root> {
  return (tree) => {
    const { pluginConfig } = this.data()
    const resolved =
      pluginConfig<boolean | { enabled: boolean }>('lightbox') ?? true
    const lightboxEnabled =
      typeof resolved === 'boolean' ? resolved : resolved.enabled

    visit(tree, 'image', (node, index, parent) => {
      if (index !== undefined && parent && parent.type !== 'link') {
        const classList: string[] = [
          ...((node.data?.hProperties as any)?.class?.split(' ') ?? []),
          ...((node.data?.hProperties as any)?.className ?? []),
        ]
        const hasDisablingClass = classList.some((c) =>
          ['off-glb', 'skip-lightbox'].includes(c),
        )
        const hasEnablingClass = classList.some((c) =>
          ['on-glb', 'force-lightbox'].includes(c),
        )
        const wrap = lightboxEnabled ? !hasDisablingClass : hasEnablingClass

        if (wrap) {
          parent.children.splice(index, 1, {
            type: 'link',
            url: node.url,
            children: [node],
            data: {
              hProperties: {
                class: 'glightbox',
              },
            },
          })
        }
      }
    })
  }
}
