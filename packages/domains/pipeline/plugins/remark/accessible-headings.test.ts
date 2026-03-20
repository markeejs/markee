import { describe, expect, it } from 'vitest'

import { remarkAccessibleHeadings } from './accessible-headings.js'

describe('remarkAccessibleHeadings', () => {
  it('increments heading depths and converts level 7 headings into strong nodes', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'heading', depth: 1, children: [{ type: 'text', value: 'One' }] },
        { type: 'heading', depth: 6, children: [{ type: 'text', value: 'Six' }] },
      ],
    } as const

    const transform = remarkAccessibleHeadings() as any
    transform(tree)

    expect(tree.children[0]).toMatchObject({
      type: 'heading',
      depth: 2,
    })
    expect(tree.children[1]).toMatchObject({
      type: 'strong',
      depth: 7,
      data: {
        hProperties: {
          role: 'heading',
        },
      },
    })
  })
})
