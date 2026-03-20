import { describe, expect, it } from 'vitest'

import { rehypeTableMerge } from './table-merge.js'

function textCell(value: string, properties: Record<string, unknown> = {}) {
  return {
    type: 'element',
    tagName: 'td',
    properties,
    children: [{ type: 'text', value }],
  }
}

describe('rehypeTableMerge', () => {
  it('merges cells across columns and rows and removes marker cells', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'table',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'tbody',
              properties: {},
              children: [
                {
                  type: 'element',
                  tagName: 'tr',
                  properties: {},
                  children: [textCell('>'), textCell('Right', { colSpan: 2 })],
                },
                {
                  type: 'element',
                  tagName: 'tr',
                  properties: {},
                  children: [textCell('Top'), textCell('Other')],
                },
                {
                  type: 'element',
                  tagName: 'tr',
                  properties: {},
                  children: [textCell('^'), textCell('Below')],
                },
              ],
            },
          ],
        },
      ],
    } as const

    const transform = rehypeTableMerge() as any
    transform(tree)

    const tbody = tree.children[0].children[0]
    expect(tbody.children[0].children).toEqual([
      {
        type: 'element',
        tagName: 'td',
        properties: { colSpan: 2 },
        children: [{ type: 'text', value: 'Right' }],
      },
    ])
    expect(tbody.children[1].children[0]).toMatchObject({
      properties: { rowSpan: 2 },
    })
    expect(tbody.children[2].children).toEqual([
      {
        type: 'element',
        tagName: 'td',
        properties: {},
        children: [{ type: 'text', value: 'Below' }],
      },
    ])
  })

  it('ignores non-marker content and non-text td children', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'table',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'tbody',
              properties: {},
              children: [
                {
                  type: 'element',
                  tagName: 'tr',
                  properties: {},
                  children: [
                    {
                      type: 'element',
                      tagName: 'td',
                      properties: {},
                      children: [
                        {
                          type: 'element',
                          tagName: 'strong',
                          properties: {},
                          children: [{ type: 'text', value: 'Bold' }],
                        },
                      ],
                    },
                    textCell('Normal'),
                  ],
                },
                {
                  type: 'element',
                  tagName: 'tr',
                  properties: {},
                  children: [
                    {
                      type: 'element',
                      tagName: 'td',
                      properties: {},
                      children: [
                        {
                          type: 'element',
                          tagName: 'em',
                          properties: {},
                          children: [{ type: 'text', value: 'Still plain content' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as const

    const transform = rehypeTableMerge() as any
    transform(tree)

    const row = tree.children[0].children[0].children[0]
    expect(row.children).toHaveLength(2)
    expect(row.children[1]).toMatchObject({
      properties: {},
      children: [{ type: 'text', value: 'Normal' }],
    })
  })
})
