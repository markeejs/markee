import { describe, expect, it, vi } from 'vitest'

async function importRemark() {
  vi.resetModules()

  const remark = vi.fn()
  const visit = vi.fn((tree: any, _type: string, callback: Function) => {
    tree.children.forEach((node: any, index: number) =>
      callback(node, index, tree),
    )
  })
  const parseAttrs = vi.fn((meta: string) => {
    if (meta.includes('off-glb')) {
      return {
        class: 'mermaid compact off-glb',
        id: 'chart-a',
        lightbox: 'true',
      }
    }
    if (meta.includes('on-glb')) {
      return { class: 'dbml roomy on-glb', lightbox: 'false' }
    }
    if (meta.includes('meta-id')) {
      return { id: 'meta-id', class: 'mermaid compact' }
    }
    return {}
  })

  vi.doMock('@markee/runtime', () => ({
    extend: {
      markdownPipeline: {
        remark,
        visit,
      },
    },
  }))
  vi.doMock('attributes-parser', () => ({
    default: parseAttrs,
  }))

  return {
    ...(await import('./remark.js')),
    remark,
    visit,
  }
}

describe('@markee/diagrams remark', () => {
  it('rewrites mermaid and dbml fences with lightbox overrides', async () => {
    const { registerDiagramsRemark, remark } = await importRemark()

    registerDiagramsRemark()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => ({ enabled: false }),
      }),
    })

    const tree = {
      children: [
        {
          lang: 'mermaid',
          meta: 'off-glb',
          value: 'graph TD;A-->B',
          data: { hProperties: { id: 'node-id' } },
        },
        {
          lang: 'dbml',
          meta: 'on-glb',
          value: 'Table users {}',
          data: {},
        },
        {
          lang: 'mermaid',
          meta: 'kroki',
          value: 'skip',
          data: {},
        },
      ],
    }

    transform(tree)

    expect((tree.children[0] as any).value).toContain('<markee-diagram')
    expect((tree.children[0] as any).value).not.toContain('glightbox')
    expect((tree.children[0] as any).value).toContain('id="node-id"')
    expect((tree.children[0] as any).value).toContain(
      'class="mermaid diagram compact off-glb"',
    )

    expect((tree.children[1] as any).value).toContain("class='glightbox'")
    expect((tree.children[1] as any).value).toContain('markee-diagram-0')
    expect((tree.children[1] as any).value).toContain(
      'class="dbml diagram roomy on-glb"',
    )

    expect(tree.children[2]).toMatchObject({
      lang: 'mermaid',
      meta: 'kroki',
    })
  })

  it('defaults lightbox behavior and ignores incomplete or unsupported nodes', async () => {
    const { registerDiagramsRemark, remark, visit } = await importRemark()

    registerDiagramsRemark()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => undefined,
      }),
    })

    transform({ children: [] })
    const callback = visit.mock.calls[0]?.[2] as Function

    expect(() =>
      callback(
        { lang: 'mermaid', value: 'graph TD;A-->B' },
        undefined,
        undefined,
      ),
    ).not.toThrow()

    const detached = {
      lang: 'mermaid',
      meta: 'meta-id',
      value: 'graph TD;A-->B',
      data: {},
    }
    const tree = {
      children: [
        detached,
        {
          lang: 'bash',
          meta: '',
          value: 'echo nope',
          data: {},
        },
        {
          lang: ' mermaid ',
          meta: 'meta-id',
          value: 'graph TD;A-->B',
          data: {},
        },
        {
          lang: 'mermaid',
          data: {},
        },
      ],
    }

    transform({
      children: tree.children,
    })

    expect((tree.children[0] as any).value).toContain("class='glightbox'")
    expect((tree.children[0] as any).value).toContain('id="meta-id"')
    expect(tree.children[1]).toMatchObject({
      lang: 'bash',
    })
    expect(tree.children[2]).toMatchObject({
      type: 'html',
      value: expect.stringContaining('data-kind="mermaid"'),
    })
    expect((tree.children[3] as any).value).toContain('data-source=""')
  })

  it('supports boolean lightbox configuration values', async () => {
    const { registerDiagramsRemark, remark } = await importRemark()

    registerDiagramsRemark()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => true,
      }),
    })

    const tree = {
      children: [
        {
          lang: 'dbml',
          meta: '',
          value: 'Table users {}',
          data: {},
        },
      ],
    }

    transform(tree)

    expect((tree.children[0] as any).value).toContain("class='glightbox'")
  })
})
