import { beforeEach, describe, expect, it, vi } from 'vitest'

const { remark, visit, parseAttrs } = vi.hoisted(() => ({
  remark: vi.fn(),
  visit: vi.fn(
    (
      tree: any,
      _type: string,
      callback: (node: any, index: number, parent: any) => void,
    ) => {
      tree.children.forEach((node: any, index: number) =>
        callback(node, index, tree),
      )
    },
  ),
  parseAttrs: vi.fn((meta: string) => {
    if (meta.includes('tag=')) {
      return { tag: '"users"', class: 'swagger compact', id: 'users-api' }
    }
    if (meta.includes('schema=')) {
      return { schema: 'Pet' }
    }
    return {}
  }),
}))

vi.mock('@markee/runtime', () => ({
  extend: {
    markdownPipeline: {
      remark,
      visit,
    },
  },
}))
vi.mock('attributes-parser', () => ({
  default: parseAttrs,
}))

import { registerSwaggerUiRemark } from './remark.js'

describe('swaggerui remark', () => {
  beforeEach(() => {
    remark.mockClear()
    visit.mockClear()
    parseAttrs.mockClear()
  })

  it('registers a remark plugin that rewrites openapi fences into custom elements', () => {
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

  it('ignores fences without a parent, index, or supported language', () => {
    registerSwaggerUiRemark()

    const factory = remark.mock.calls[0]?.[1] as Function
    const transform = factory()
    const parentless = { lang: 'openapi', meta: '', value: 'x', data: {} }
    const unsupported = { lang: 'yaml', meta: '', value: 'x', data: {} }
    const missingLang = { meta: '', value: 'x', data: {} }

    transform({
      children: [parentless, unsupported, missingLang],
    })

    expect(parentless.lang).toBe('openapi')
    expect(unsupported.lang).toBe('yaml')
    expect(missingLang).toEqual({ meta: '', value: 'x', data: {} })
  })
})
