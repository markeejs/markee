import { describe, expect, it } from 'vitest'

import { remarkHtmlEscapeSequences } from './html-escape-sequences.js'

describe('remarkHtmlEscapeSequences', () => {
  it('splits text nodes around html escape sequences', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Alpha &amp; Beta &copy;' }],
        },
      ],
    } as const

    const transform = remarkHtmlEscapeSequences() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Alpha ' },
        { type: 'html', value: '&amp;' },
        { type: 'text', value: ' Beta ' },
        { type: 'html', value: '&copy;' },
        { type: 'text', value: '' },
      ],
    })
  })

  it('leaves plain text untouched', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Alpha Beta' }],
        },
      ],
    } as const

    const transform = remarkHtmlEscapeSequences() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Alpha Beta' }],
    })
  })
})
