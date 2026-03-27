import type { Processor } from 'unified'
import parseAttrs from 'attributes-parser'
import { extend } from '@markee/runtime'
import {
  encodeText,
  escapeHtml,
  getBooleanFromMeta,
  getClassList,
  getStringFromMeta,
  hasClass,
} from './helpers'

export function registerDiagramsRemark() {
  extend.markdownPipeline.remark('markee-diagrams', function (this: Processor) {
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
          if (lang !== 'mermaid' && lang !== 'dbml') return
          if ((node.meta ?? '').trim().startsWith('kroki')) return

          const source = encodeText(node.value ?? '')
          const parsedMeta = parseAttrs(node.meta ?? '')
          const fromNodeId = (node.data as any)?.hProperties?.id
          const fromMetaId = getStringFromMeta(parsedMeta, 'id')
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

          const uniqueId =
            (fromNodeId ? String(fromNodeId) : fromMetaId) ||
            `markee-diagram-${fallbackId++}`
          const extraClasses = getClassList(parsedMeta).filter(
            (name) => name !== lang,
          )
          const className = [lang, 'diagram', ...extraClasses].join(' ')

          const element = `<markee-diagram id="${escapeHtml(uniqueId)}" class="${escapeHtml(className)}" data-kind="${lang}" data-source="${source}"></markee-diagram>`
          const inlineElement = `<markee-diagram class="${escapeHtml(className)}" data-kind="${lang}" data-source="${source}"></markee-diagram>`
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
