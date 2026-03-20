import { describe, expect, it, vi } from 'vitest'

vi.mock('../resources/fontawesome-definition.js', () => ({
  brands: ['github'],
  regular: ['address-book'],
  solid: ['user'],
}))

import { remarkFontAwesome } from './fontawesome.js'

describe('remarkFontAwesome', () => {
  it('converts prefixed and inferred fontawesome tokens into icon nodes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value:
                'A :fontawesome-brands-github: B :fontawesome-regular-address-book: C :fontawesome-solid-house: D :fontawesome-user: E :fontawesome-address-book: F :fontawesome-github: G :fontawesome-unknown:',
            },
          ],
        },
      ],
    }

    const transform = remarkFontAwesome() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'A ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-brands', 'fa-github'],
            },
          },
        },
        { type: 'text', value: ' B ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-regular', 'fa-address-book'],
            },
          },
        },
        { type: 'text', value: ' C ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-solid', 'fa-house'],
            },
          },
        },
        { type: 'text', value: ' D ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-solid', 'fa-user'],
            },
          },
        },
        { type: 'text', value: ' E ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-regular', 'fa-address-book'],
            },
          },
        },
        { type: 'text', value: ' F ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-brands', 'fa-github'],
            },
          },
        },
        { type: 'text', value: ' G ' },
        {
          type: 'text',
          value: '',
          data: {
            hName: 'i',
            hProperties: {
              className: ['fa-fontawesome', 'fa-solid', 'fa-unknown'],
            },
          },
        },
        { type: 'text', value: '' },
      ],
    })
  })

  it('leaves plain text untouched when there is no fontawesome token', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Plain text only.' }],
        },
      ],
    }

    const transform = remarkFontAwesome() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Plain text only.' }],
    })
  })
})
