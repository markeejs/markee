import parseAttrs from 'attributes-parser'
import { extend } from '@markee/runtime'
import {
  encodeText,
  escapeHtml,
  getClassList,
  getStringFromMeta,
} from './helpers'
import type { SwaggerUiFilters } from './filters'

function normalizeFilters(meta: Record<string, any>): SwaggerUiFilters {
  return {
    tag: getStringFromMeta(meta, 'tag'),
    operation: getStringFromMeta(meta, 'operation'),
    schema: getStringFromMeta(meta, 'schema'),
  }
}

function isSwaggerUiFence(lang: string) {
  return lang === 'openapi' || lang === 'swagger'
}

export function registerSwaggerUiRemark() {
  extend.markdownPipeline.remark('markee-swaggerui', function () {
    return (tree) => {
      let fallbackId = 0

      extend.markdownPipeline.visit(tree, 'code', (node, index, parent) => {
        const lang = node.lang?.trim()?.toLowerCase()

        if (!parent || index === undefined || !lang) return
        if (!isSwaggerUiFence(lang)) return

        const parsedMeta = parseAttrs(node.meta ?? '')
        const source = encodeText(node.value ?? '')
        const filters = normalizeFilters(parsedMeta)
        const filtersEncoded = encodeText(JSON.stringify(filters))
        const fromNodeId = (node.data as any)?.hProperties?.id
        const fromMetaId = getStringFromMeta(parsedMeta, 'id')
        const uniqueId =
          (fromNodeId ? String(fromNodeId) : fromMetaId) ||
          `markee-swaggerui-${fallbackId++}`
        const extraClasses = getClassList(parsedMeta).filter(
          (className) => className !== lang,
        )
        const classes = ['swaggerui', ...extraClasses].join(' ')
        const filtersAttribute =
          filters.tag || filters.operation || filters.schema
            ? ` data-filters="${escapeHtml(filtersEncoded)}"`
            : ''

        const element = `<markee-swaggerui id="${escapeHtml(uniqueId)}" class="${escapeHtml(classes)}" data-source="${escapeHtml(source)}"${filtersAttribute}></markee-swaggerui>`

        parent.children.splice(index, 1, {
          type: 'html',
          value: element,
        })
      })
    }
  })
}
