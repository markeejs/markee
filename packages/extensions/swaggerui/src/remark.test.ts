import { describe, expect, it, vi } from 'vitest'

async function importRemark() {
  vi.resetModules()

  const remark = vi.fn()
  const visit = vi.fn(
    (
      tree: any,
      _type: string,
      callback: (node: any, index: number, parent: any) => void,
    ) => {
      tree.children.forEach((node: any, index: number) =>
        callback(node, index, tree),
      )
    },
  )
  const parseAttrs = vi.fn((meta: string) => {
    if (meta.includes('tag=')) {
      return {
        tag: '"users"',
        class: 'swagger compact',
        id: 'users-api',
      }
    }
    if (meta.includes('schema=')) {
      return { schema: 'Pet' }
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

describe('swaggerui remark', () => {
  it('registers a remark plugin that rewrites openapi fences into custom elements', async () => {
    const { registerSwaggerUiRemark, remark } = await importRemark()

    registerSwaggerUiRemark()

    expect(remark).toHaveBeenCalledWith(
      'markee-swaggerui',
      expect.any(Function),
    )

    const tree = {
      children: [
        {
          lang: 'openapi',
          meta: 'tag=users class="swagger compact" id=users-api',
          value: 'openapi: 3.1.0',
          data: {
            hProperties: {
              id: 'node-id',
            },
          },
        },
        {
          lang: 'swagger',
          meta: 'schema=Pet',
          value: '{"openapi":"3.0.0"}',
          data: {},
        },
        {
          lang: 'openapi',
          value: undefined,
          data: {},
        },
        {
          lang: 'bash',
          meta: '',
          value: 'echo nope',
          data: {},
        },
      ],
    }

    const factory = remark.mock.calls[0]?.[1] as Function
    factory()(tree)

    expect(tree.children[0]).toMatchObject({
      type: 'html',
      value: expect.stringContaining('markee-swaggerui'),
    })
    expect((tree.children[0] as any).value).toContain('id="node-id"')
    expect((tree.children[0] as any).value).toContain(
      'class="swaggerui swagger compact"',
    )
    expect((tree.children[0] as any).value).toContain('data-source=')
    expect((tree.children[0] as any).value).toContain('data-filters=')

    expect((tree.children[1] as any).value).toContain('id="markee-swaggerui-0"')
    expect((tree.children[1] as any).value).toContain('class="swaggerui"')
    expect((tree.children[1] as any).value).toContain('data-filters=')
    expect((tree.children[2] as any).value).toContain('id="markee-swaggerui-1"')
    expect((tree.children[2] as any).value).toContain('data-source=""')
    expect((tree.children[2] as any).value).not.toContain('data-filters=')

    expect(tree.children[3]).toMatchObject({
      lang: 'bash',
      value: 'echo nope',
    })
  })

  it('ignores fences without a parent, index, or supported language', async () => {
    const { registerSwaggerUiRemark, remark, visit } = await importRemark()

    registerSwaggerUiRemark()

    const transform = remark.mock.calls[0]?.[1]()

    transform({ children: [] })
    const callback = visit.mock.calls[0]?.[2] as Function

    expect(() =>
      callback({ lang: 'openapi', value: 'x', data: {} }, undefined, undefined),
    ).not.toThrow()

    const tree = {
      children: [
        { lang: 'yaml', meta: '', value: 'x', data: {} },
        { meta: '', value: 'x', data: {} },
      ],
    }

    transform(tree)

    const unsupported = tree.children[0]
    const missingLang = tree.children[1]
    expect(unsupported.lang).toBe('yaml')
    expect(missingLang).toEqual({ meta: '', value: 'x', data: {} })
  })
})
