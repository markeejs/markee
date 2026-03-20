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
})
