import { describe, expect, it, vi } from 'vitest'

function createVisit() {
  return vi.fn((tree: any, _type: string, callback: Function) => {
    tree.children.forEach((node: any, index: number) => {
      callback(node, index, tree)
    })
  })
}

async function importRemarkKroki({ development = false } = {}) {
  vi.resetModules()

  const remark = vi.fn()
  const visit = createVisit()
  const valueCache = { set: vi.fn() }

  vi.doMock('@markee/runtime', () => ({
    development,
    extend: {
      markdownPipeline: {
        remark,
        visit,
      },
    },
  }))
  vi.doMock('../shared/cache.mjs', () => ({
    valueCache,
  }))

  await import('./remark-kroki.mjs')

  return { remark, valueCache }
}

describe('@markee/kroki remark', () => {
  it('registers the plugin and rewrites kroki fences with lightbox markup', async () => {
    const { remark, valueCache } = await importRemarkKroki()

    expect(remark).toHaveBeenCalledWith('markee-kroki', expect.any(Function))

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: (name: string) => {
          if (name === 'kroki') return { prerender: false }
          return undefined
        },
      }),
    })

    const node = {
      lang: 'mermaid.flow',
      meta: 'kroki .diagram #chart width="100" :zoom {theme} flag',
      value: 'graph TD;A-->B',
      data: {
        hProperties: {
          id: 'diagram-1',
        },
      },
    }
    const ignored = {
      lang: 'bash',
      meta: 'shell',
      value: 'echo nope',
      data: { hProperties: { id: 'skip' } },
    }
    const tree = { children: [node, ignored] }

    transform(tree)

    expect(valueCache.set).toHaveBeenCalledWith('diagram-1', 'graph TD;A-->B')
    expect(tree.children[0]).toMatchObject({
      type: 'html',
      value: expect.stringContaining("<a class='glightbox'"),
    })
    expect((tree.children[0] as any).value).toContain(
      "<markee-kroki id='diagram-1' class='mermaid flow'",
    )
    expect((tree.children[0] as any).value).toContain('className="diagram"')
    expect((tree.children[0] as any).value).toContain('id="chart"')
    expect((tree.children[0] as any).value).toContain('width="100"')
    expect((tree.children[0] as any).value).toContain('zoom="true"')
    expect((tree.children[0] as any).value).toContain('theme="true"')
    expect((tree.children[0] as any).value).toContain('flag="true"')
    expect(tree.children[1]).toBe(ignored)
  })

  it('supports disabled lightbox and prerendered mode without caching', async () => {
    const { remark, valueCache } = await importRemarkKroki()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: (name: string) => {
          if (name === 'kroki') return { prerender: true }
          if (name === 'lightbox') return { enabled: false }
          return undefined
        },
      }),
    })

    const node = {
      lang: 'blockdiag',
      meta: 'kroki',
      value: 'blockdiag {}',
      data: {
        hProperties: {
          id: 'diagram-2',
        },
      },
    }
    const tree = { children: [node] }

    transform(tree)

    expect(valueCache.set).not.toHaveBeenCalled()
    expect((tree.children[0] as any).value).not.toContain('glightbox')
    expect((tree.children[0] as any).value).toContain(
      "<markee-kroki id='diagram-2' class='blockdiag'",
    )
  })

  it('still caches in development even when prerender is enabled', async () => {
    const { remark, valueCache } = await importRemarkKroki({
      development: true,
    })

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => ({ prerender: true }),
      }),
    })

    const node = {
      lang: 'blockdiag',
      meta: 'kroki',
      value: 'diagram',
      data: { hProperties: { id: 'diagram-3' } },
    }

    transform({ children: [node] })

    expect(valueCache.set).toHaveBeenCalledWith('diagram-3', 'diagram')
  })

  it('falls back to default config values and ignores malformed kroki attributes', async () => {
    const { remark, valueCache } = await importRemarkKroki()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => undefined,
      }),
    })

    const tree = {
      children: [
        {
          lang: 'mermaid',
          meta: 'kroki :="nope" {}',
          value: 'graph TD;A-->B',
          position: { start: { offset: 42 } },
          data: { hProperties: {} },
        },
      ],
    }

    transform(tree)

    expect(valueCache.set).toHaveBeenCalledWith('kroki-42', 'graph TD;A-->B')
    expect((tree.children[0] as any).value).toContain("class='glightbox'")
    expect((tree.children[0] as any).value).toContain("id='kroki-42'")
    expect((tree.children[0] as any).value).not.toContain('=""')
  })

  it('handles meta objects whose matcher returns no attributes', async () => {
    const { remark, valueCache } = await importRemarkKroki()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => undefined,
      }),
    })

    const meta = {
      startsWith: (value: string) => value === 'kroki',
      match: () => null,
    }
    const tree = {
      children: [
        {
          lang: 'blockdiag',
          meta,
          value: 'blockdiag {}',
          position: { start: { offset: 7 } },
          data: { hProperties: {} },
        },
      ],
    }

    transform(tree)

    expect(valueCache.set).toHaveBeenCalledWith('kroki-7', 'blockdiag {}')
    expect((tree.children[0] as any).value).toContain("class='glightbox'")
    expect((tree.children[0] as any).value).toContain("id='kroki-7'")
  })
})
