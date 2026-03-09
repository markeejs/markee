import { loadKrokiDiagram } from '../shared/kroki-resolver.mjs'

const cache = new Map()
async function loadDiagram(engine, server, content) {
  if (!cache.has(content)) {
    cache.set(content, loadKrokiDiagram(engine, server, content))
  }
  return await cache.get(content)
}

export const name = 'kroki'
export const preloadFence = async (fence, params) => {
  if (!params.prerender) return { attrs: { 'data-prerendered': false } }
  if (command !== 'build') return { attrs: { 'data-prerendered': false } }

  if (fence.attrs.kroki) {
    let payload = ''
    try {
      payload = await loadDiagram(fence.lang, params.serverUrl, fence.content)
    } catch (err) {
      void err
      payload =
        '<div class="markee-kroki-error">Please set <code>plugins.kroki.serverUrl</code> in your markee.yaml</div>'
    }
    return {
      payload,
      attrs: {
        'data-prerendered': 'data-prerendered',
      },
    }
  }
}
