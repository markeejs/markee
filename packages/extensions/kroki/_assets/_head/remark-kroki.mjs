import { development, extend } from '@markee/runtime'
import { valueCache } from '../shared/cache.mjs'

const attrsRegex = /([^\s=]+(-[^\s=]+)*)(?:\s*=\s*(".*?"|'.*?'|\S+))?/g

function parseAttributes(attrs, properties) {
  const attrArray = attrs.match(attrsRegex) ?? []
  attrArray.forEach((attr) => {
    let [key, value] = attr.split('=')

    if (key?.startsWith(':')) {
      key = key.slice(1)
    }
    if (key?.startsWith('{')) {
      key = key.slice(1)
    }
    if (key?.endsWith('}')) {
      key = key.slice(0, -1)
    }

    if (!key) {
      return
    }

    if (key.startsWith('.')) {
      value = key.slice(1)
      key = 'className'
    }
    if (key.startsWith('#')) {
      value = key.slice(1)
      key = 'id'
    }
    value = value?.replace(/"(.*)"/, '$1').replace(/'(.*)'/, '$1')

    if (key !== 'className') {
      properties[key] = value ?? true
    } else {
      properties[key] = [...(properties[key] ?? []), ...value.split('.')]
    }
  })
  return properties
}

extend.markdownPipeline.remark('markee-kroki', function () {
  return (tree) => {
    const { prerender } = this.data().pluginConfig('kroki') ?? {
      prerender: false,
    }
    const resolved = this.data().pluginConfig('lightbox') ?? true
    const lightboxEnabled =
      typeof resolved === 'boolean' ? resolved : resolved.enabled

    extend.markdownPipeline.visit(tree, 'code', (node, index, parent) => {
      if (parent && index !== undefined && node.meta?.startsWith('kroki')) {
        const uniqueId =
          node.data.hProperties?.id ?? `kroki-${node.position.start.offset}`
        const properties = Object.entries(parseAttributes(node.meta, {}))
          .filter(([key]) => key !== 'kroki')
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ')

        if (!prerender || development) {
          valueCache.set(uniqueId, node.value)
        }
        const withLightbox = `
              <a class='glightbox' href='#${uniqueId}' data-width='100vw' data-height='auto' data-draggable='false'>
                <markee-kroki id='${uniqueId}' class='${node.lang.replaceAll('.', ' ')}' ${properties}></markee-kroki>
              </a>
            `
        const withoutLightbox = `
              <markee-kroki id='${uniqueId}' class='${node.lang.replaceAll('.', ' ')}' ${properties}></markee-kroki>
            `

        parent.children.splice(index, 1, {
          type: 'html',
          value: lightboxEnabled ? withLightbox : withoutLightbox,
        })
      }
    })
  }
})
