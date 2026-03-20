import { describe, expect, it } from 'vitest'

import { remarkMaterialIcons } from './material-icons.js'

describe('remarkMaterialIcons', () => {
  it('converts :material-...: syntax into mdi icon nodes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Before :material-home: after :material-account-box:',
            },
          ],
        },
      ],
    } as const

    const transform = remarkMaterialIcons() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Before ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['mdi-material', 'mdi', 'mdi-home'],
            },
          },
        },
        { type: 'text', value: ' after ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['mdi-material', 'mdi', 'mdi-account-box'],
            },
          },
        },
        { type: 'text', value: '' },
      ],
    })
  })

  it('leaves text untouched when no material icon token is present', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Plain text.' }],
        },
      ],
    } as const

    const transform = remarkMaterialIcons() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Plain text.' }],
    })
  })
})
