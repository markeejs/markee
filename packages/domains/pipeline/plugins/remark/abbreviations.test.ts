import { describe, expect, it } from 'vitest'

import { remarkAbbreviations } from './abbreviations.js'

describe('remarkAbbreviations', () => {
  it('extracts abbreviation definitions, removes the definition paragraph, and wraps matches', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '*[API]: Application Programming Interface' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'The API is stable.' }],
        },
      ],
    } as const

    const transform = remarkAbbreviations() as any
    transform(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'The ' },
        {
          type: 'strong',
          data: {
            hName: 'abbr',
            hProperties: {
              title: ' Application Programming Interface',
            },
          },
          children: [{ type: 'text', value: 'API' }],
        },
        { type: 'text', value: ' is stable.' },
      ],
    })
  })

  it('uses true when an abbreviation is declared without a title', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '*[HTML]:' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'HTML first.' }],
        },
      ],
    } as const

    const transform = remarkAbbreviations() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'strong',
          data: {
            hName: 'abbr',
            hProperties: {
              title: true,
            },
          },
          children: [{ type: 'text', value: 'HTML' }],
        },
        { type: 'text', value: ' first.' },
      ],
    })
  })

  it('ignores non-definition lines inside an abbreviation paragraph', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: '*[API]: Application Programming Interface\nnot a definition',
            },
          ],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'API docs' }],
        },
      ],
    } as const

    const transform = remarkAbbreviations() as any
    transform(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'strong',
          data: {
            hName: 'abbr',
            hProperties: {
              title: ' Application Programming Interface',
            },
          },
          children: [{ type: 'text', value: 'API' }],
        },
        { type: 'text', value: ' docs' },
      ],
    })
  })

  it('leaves text alone when no abbreviation definitions are present', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Plain text only.' }],
        },
      ],
    } as const

    const transform = remarkAbbreviations() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Plain text only.' }],
    })
  })
})
