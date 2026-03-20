import { describe, expect, it } from 'vitest'

import { remarkFootnoteOrdering } from './footnote-ordering.js'

describe('remarkFootnoteOrdering', () => {
  it('prepends dummy references for referenced definitions in definition order', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Intro' }] },
        { type: 'footnoteDefinition', label: 'b', children: [] },
        { type: 'footnoteDefinition', label: 'a', children: [] },
        { type: 'footnoteReference', identifier: 'a' },
        { type: 'footnoteReference', identifier: 'b' },
        { type: 'footnoteReference', identifier: 'a' },
      ],
    } as const

    const transform = remarkFootnoteOrdering() as any
    transform(tree)

    expect(tree.children.slice(0, 2)).toEqual([
      {
        type: 'footnoteReference',
        identifier: 'b',
        data: {
          hProperties: {
            dummy: 'true',
          },
        },
      },
      {
        type: 'footnoteReference',
        identifier: 'a',
        data: {
          hProperties: {
            dummy: 'true',
          },
        },
      },
    ])
  })

  it('skips definitions that are never referenced', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'footnoteDefinition', label: 'a', children: [] },
        { type: 'footnoteDefinition', label: 'b', children: [] },
        { type: 'footnoteReference', identifier: 'b' },
      ],
    } as const

    const transform = remarkFootnoteOrdering() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'footnoteReference',
      identifier: 'b',
      data: {
        hProperties: {
          dummy: 'true',
        },
      },
    })
    expect(tree.children[1]).toMatchObject({
      type: 'footnoteDefinition',
      label: 'a',
    })
  })
})
