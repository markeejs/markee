import { describe, expect, it, vi } from 'vitest'

async function importPreload({
  loadKrokiDiagram = vi.fn(),
  command = 'build',
}: {
  loadKrokiDiagram?: ReturnType<typeof vi.fn>
  command?: string
} = {}) {
  vi.resetModules()

  vi.doMock('../shared/kroki-resolver.mjs', () => ({
    loadKrokiDiagram,
  }))

  return {
    ...(await import('./preload.mjs')),
    context: {
      command,
      mode: 'production',
    },
    loadKrokiDiagram,
  }
}

describe('@markee/kroki preload', () => {
  it('skips prerendering when disabled or not building', async () => {
    const { preloadFence, context } = await importPreload({
      command: 'develop',
    })

    await expect(
      preloadFence(
        { attrs: { kroki: true }, lang: 'mermaid', content: 'graph TD;A-->B' },
        { prerender: false, serverUrl: 'https://kroki.io' },
        context,
      ),
    ).resolves.toEqual({
      attrs: { 'data-prerendered': false },
    })

    await expect(
      preloadFence(
        { attrs: { kroki: true }, lang: 'mermaid', content: 'graph TD;A-->B' },
        { prerender: true, serverUrl: 'https://kroki.io' },
        context,
      ),
    ).resolves.toEqual({
      attrs: { 'data-prerendered': false },
    })
  })

  it('returns prerendered payloads, caches repeated content, and formats resolver failures', async () => {
    const loadKrokiDiagram = vi
      .fn()
      .mockResolvedValueOnce('<svg>ok</svg>')
      .mockRejectedValueOnce(new Error('boom'))
    const { preloadFence, context } = await importPreload({ loadKrokiDiagram })

    await expect(
      preloadFence(
        { attrs: { kroki: true }, lang: 'mermaid', content: 'graph TD;A-->B' },
        { prerender: true, serverUrl: 'https://kroki.io' },
        context,
      ),
    ).resolves.toEqual({
      payload: '<svg>ok</svg>',
      attrs: { 'data-prerendered': 'data-prerendered' },
    })

    await expect(
      preloadFence(
        { attrs: { kroki: true }, lang: 'mermaid', content: 'graph TD;A-->B' },
        { prerender: true, serverUrl: 'https://kroki.io' },
        context,
      ),
    ).resolves.toEqual({
      payload: '<svg>ok</svg>',
      attrs: { 'data-prerendered': 'data-prerendered' },
    })

    await expect(
      preloadFence(
        { attrs: { kroki: true }, lang: 'blockdiag', content: 'broken' },
        { prerender: true, serverUrl: 'https://kroki.io' },
        context,
      ),
    ).resolves.toEqual({
      payload:
        '<div class="markee-kroki-error">Please set <code>plugins.kroki.serverUrl</code> in your markee.yaml</div>',
      attrs: { 'data-prerendered': 'data-prerendered' },
    })

    await expect(
      preloadFence(
        { attrs: {}, lang: 'mermaid', content: 'graph TD;A-->B' },
        { prerender: true, serverUrl: 'https://kroki.io' },
        context,
      ),
    ).resolves.toBeUndefined()

    expect(loadKrokiDiagram).toHaveBeenCalledTimes(2)
  })
})
