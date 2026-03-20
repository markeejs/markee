import { describe, expect, it } from 'vitest'

import { rehypeTasklist } from './tasklist.js'

describe('rehypeTasklist', () => {
  it('enables checkboxes inside task list items', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'ul',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'li',
              properties: { className: ['task-list-item'] },
              children: [
                {
                  type: 'element',
                  tagName: 'input',
                  properties: { type: 'checkbox', disabled: true },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as const

    const transform = rehypeTasklist() as any
    transform(tree)

    expect(tree.children[0].children[0].children[0].properties.disabled).toBe(
      false,
    )
  })

  it('leaves non-task inputs unchanged', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'ul',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'li',
              properties: {},
              children: [
                {
                  type: 'element',
                  tagName: 'input',
                  properties: { type: 'checkbox', disabled: true },
                  children: [],
                },
                {
                  type: 'element',
                  tagName: 'input',
                  properties: { type: 'text', disabled: true },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as const

    const transform = rehypeTasklist() as any
    transform(tree)

    expect(tree.children[0].children[0].children[0].properties.disabled).toBe(
      true,
    )
    expect(tree.children[0].children[0].children[1].properties.disabled).toBe(
      true,
    )
  })
})
