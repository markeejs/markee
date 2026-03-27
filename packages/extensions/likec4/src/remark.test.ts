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
    if (meta.includes('on-glb')) {
      return {
        'class': 'likec4 on-glb',
        'view': 'overview',
        'zoom': 'true',
        'pan': 'false',
        'max-height': '24rem',
      }
    }
    if (meta.includes('meta')) {
      return {
        class: 'likec4 compact',
      }
    }
    if (meta.includes('pan-on')) {
      return {
        class: 'likec4 compact',
        pan: 'true',
      }
    }
    return {
      class: 'likec4 off-glb',
      lightbox: 'true',
    }
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

describe('@markee/likec4 remark', () => {
  it('rewrites likec4 fences with data attributes and lightbox overrides', async () => {
    const { registerLikeC4Remark, remark } = await importRemark()

    registerLikeC4Remark()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => ({ enabled: false }),
      }),
    })

    const tree = {
      children: [
        {
          lang: 'c4',
          meta: 'on-glb',
          value: 'model {}',
          data: { hProperties: { id: 'view-1' } },
        },
        {
          lang: 'likec4',
          meta: 'off-glb',
          value: 'model {}',
          data: {},
        },
      ],
    }

    transform(tree)

    expect((tree.children[0] as any).value).toContain("class='glightbox'")
    expect((tree.children[0] as any).value).toContain('id="view-1"')
    expect((tree.children[0] as any).value).toContain('data-view="overview"')
    expect((tree.children[0] as any).value).toContain('data-zoom="true"')
    expect((tree.children[0] as any).value).toContain('data-pan="false"')
    expect((tree.children[0] as any).value).toContain('data-max-height="24rem"')

    expect((tree.children[1] as any).value).toContain('markee-likec4-0')
    expect((tree.children[1] as any).value).not.toContain('glightbox')
  })

  it('defaults lightbox behavior and ignores unsupported or detached nodes', async () => {
    const { registerLikeC4Remark, remark, visit } = await importRemark()

    registerLikeC4Remark()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => undefined,
      }),
    })

    transform({ children: [] })
    const callback = visit.mock.calls[0]?.[2] as Function

    expect(() =>
      callback({ lang: 'likec4', value: 'model {}' }, undefined, undefined),
    ).not.toThrow()

    const tree = {
      children: [
        {
          lang: 'likec4',
          meta: 'meta',
          value: 'model {}',
          data: {},
        },
        {
          lang: 'bash',
          meta: '',
          value: 'echo nope',
          data: {},
        },
        {
          lang: 'c4',
          meta: 'pan-on',
          data: {},
        },
      ],
    }

    transform(tree)

    expect((tree.children[0] as any).value).toContain("class='glightbox'")
    expect((tree.children[0] as any).value).toContain('markee-likec4-0')
    expect((tree.children[0] as any).value).toContain('data-pan="false"')
    expect(tree.children[1]).toMatchObject({
      lang: 'bash',
    })
    expect((tree.children[2] as any).value).toContain('data-source=""')
    expect((tree.children[2] as any).value).toContain('data-pan="true"')
  })

  it('supports boolean lightbox configuration values and undefined metadata', async () => {
    const { registerLikeC4Remark, remark } = await importRemark()

    registerLikeC4Remark()

    const transform = remark.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: () => false,
      }),
    })

    const tree = {
      children: [
        {
          lang: 'likec4',
          meta: 'meta',
          value: 'model {}',
          data: {},
        },
        {
          lang: 'c4',
          data: {},
        },
      ],
    }

    transform(tree)

    expect((tree.children[0] as any).value).not.toContain("class='glightbox'")
    expect((tree.children[1] as any).value).toContain('data-source=""')
  })
})
