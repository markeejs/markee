import { describe, expect, it } from 'vitest'

import { remarkSimpleIcons } from './simple-icons.js'

describe('remarkSimpleIcons', () => {
  it('converts :simple-...: syntax into simple-icons nodes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Use :simple-github: and :simple-npm:.' },
          ],
        },
      ],
    }

    const transform = remarkSimpleIcons() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Use ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['si', 'si-github'],
            },
          },
        },
        { type: 'text', value: ' and ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['si', 'si-npm'],
            },
          },
        },
        { type: 'text', value: '.' },
      ],
    })
  })

  it('does nothing when there are no simple icon tokens', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Nothing to replace.' }],
        },
      ],
    }

    const transform = remarkSimpleIcons() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Nothing to replace.' }],
    })
  })
})
