import { describe, expect, it } from 'vitest'

import { rehypePrism } from './prism.js'

describe('rehypePrism', () => {
  it('moves prism properties to the parent pre and injects a title node', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {
                prism: JSON.stringify({
                  'class': 'language-typescript',
                  'data-start': '3',
                }),
                title: 'example.ts',
              },
              children: [{ type: 'text', value: 'const answer = 42' }],
            },
          ],
        },
      ],
    }

    const transform = rehypePrism() as any
    transform(tree)

    const pre = tree.children[0]
    expect(pre.properties).toEqual({
      'class': 'language-typescript',
      'data-start': '3',
    })
    expect(pre.children[0]).toEqual({
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['mk-prism-title'],
      },
      children: [{ type: 'text', value: 'example.ts' }],
    })
    expect(pre.children[1]).toEqual({
      type: 'element',
      tagName: 'code',
      properties: {},
      children: [{ type: 'text', value: 'const answer = 42' }],
    })
  })

  it('ignores non-prism nodes and leaves untitled prism code blocks inline', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { existing: true },
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {
                prism: JSON.stringify({
                  class: 'language-javascript',
                }),
              },
              children: [{ type: 'text', value: 'console.log(1)' }],
            },
            {
              type: 'element',
              tagName: 'span',
              properties: {
                prism: 'ignored',
              },
              children: [{ type: 'text', value: 'not code' }],
            },
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: [{ type: 'text', value: 'plain code' }],
            },
          ],
        },
      ],
    }

    const transform = rehypePrism() as any
    transform(tree)

    const pre = tree.children[0]
    expect(pre.properties).toEqual({
      class: 'language-javascript',
    })
    expect(pre.children).toHaveLength(3)
    expect(pre.children[0]).toEqual({
      type: 'element',
      tagName: 'code',
      properties: {},
      children: [{ type: 'text', value: 'console.log(1)' }],
    })
    expect(pre.children[1]).toEqual({
      type: 'element',
      tagName: 'span',
      properties: {
        prism: 'ignored',
      },
      children: [{ type: 'text', value: 'not code' }],
    })
    expect(pre.children[2]).toEqual({
      type: 'element',
      tagName: 'code',
      properties: {},
      children: [{ type: 'text', value: 'plain code' }],
    })
  })
})
