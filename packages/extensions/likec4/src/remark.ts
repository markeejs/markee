import type { Processor } from 'unified'
import parseAttrs from 'attributes-parser'
import { extend } from '@markee/runtime'
import {
  encodeText,
  getBooleanFromMeta,
  getStringFromMeta,
  hasClass,
  normalizeMaxHeight,
} from './helpers'

export function registerLikeC4Remark() {
  extend.markdownPipeline.remark('markee-likec4', function (this: Processor) {
    return (tree: any) => {
      const { pluginConfig } = this.data()
      const resolved = pluginConfig<boolean | { enabled: boolean }>('lightbox')
      const lightboxEnabled =
        typeof resolved === 'boolean' ? resolved : (resolved?.enabled ?? true)

      let fallbackId = 0

      extend.markdownPipeline.visit(
        tree,
        'code',
        (node: any, index: number | undefined, parent: any) => {
          const lang = node.lang?.trim()?.toLowerCase()
          if (!parent || index === undefined) return
          if (lang !== 'c4' && lang !== 'likec4') return

          const source = encodeText(node.value ?? '')
          const parsedMeta = parseAttrs(node.meta ?? '')
          const viewId = getStringFromMeta(parsedMeta, 'view')
          const zoomEnabled = getBooleanFromMeta(parsedMeta, 'zoom', false)
          const panEnabled = getBooleanFromMeta(parsedMeta, 'pan', false)
          const maxHeight = normalizeMaxHeight(
            getStringFromMeta(parsedMeta, 'max-height'),
          )
          const hasLightboxDisableClass =
            hasClass(parsedMeta, 'skip-lightbox') ||
            hasClass(parsedMeta, 'off-glb')
          const hasLightboxEnableClass =
            hasClass(parsedMeta, 'force-lightbox') ||
            hasClass(parsedMeta, 'on-glb')
          let nodeLightboxEnabled = getBooleanFromMeta(
            parsedMeta,
            'lightbox',
            lightboxEnabled,
          )
          if (hasLightboxDisableClass) {
            nodeLightboxEnabled = false
          } else if (hasLightboxEnableClass) {
            nodeLightboxEnabled = true
          }

          const fromNodeId = (node.data as any)?.hProperties?.id
          const uniqueId = fromNodeId
            ? String(fromNodeId)
            : `markee-likec4-${fallbackId++}`
          const viewAttribute = viewId ? ` data-view="${viewId}"` : ''
          const zoomAttribute = ` data-zoom="${zoomEnabled ? 'true' : 'false'}"`
          const panAttribute = ` data-pan="${panEnabled ? 'true' : 'false'}"`
          const maxHeightAttribute = maxHeight
            ? ` data-max-height="${maxHeight}"`
            : ''
          const classes = `${lang} likec4`
          const element = `<markee-likec4 id="${uniqueId}" class="${classes}" data-source="${source}"${viewAttribute}${zoomAttribute}${panAttribute}${maxHeightAttribute}></markee-likec4>`
          const inlineElement = `<markee-likec4 class="${classes}" data-source="${source}"${viewAttribute}${zoomAttribute}${panAttribute}${maxHeightAttribute}></markee-likec4>`
          const inlineContent = inlineElement.replaceAll("'", '&#39;')
          const withLightbox = `<a class='glightbox' href='#' data-content='${inlineContent}' data-width='100vw' data-height='auto' data-draggable='false'>${element}</a>`

          parent.children.splice(index, 1, {
            type: 'html',
            value: nodeLightboxEnabled ? withLightbox : element,
          })
        },
      )
    }
  })
}
