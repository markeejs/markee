import { afterEach, describe, expect, it, vi } from 'vitest'

import { remarkAttrs } from './attrs.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remarkAttrs', () => {
  it('wraps inline [content]{attrs} spans inside a text node', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Before [Chip]{class="badge" data-id="1"} after',
            },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Before ' },
        {
          type: 'span',
          data: {
            hName: 'span',
            hProperties: {
              className: ['badge'],
              'data-id': '1',
            },
          },
          children: [{ type: 'text', value: 'Chip' }],
        },
        { type: 'text', value: ' after' },
      ],
    })
  })

  it('falls back to empty content and attrs when a matched span entry cannot be parsed again', () => {
    const originalMatch = String.prototype.match
    vi.spyOn(String.prototype, 'match').mockImplementation(function (
      this: string,
      matcher: any,
    ) {
      if (
        this.toString() === '[broken]{class="badge"}' &&
        matcher instanceof RegExp &&
        matcher.source === /\[(.*?)]\{(.*?)}/.source
      ) {
        return null
      }

      return originalMatch.call(this, matcher as any)
    })

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '[broken]{class="badge"}' }],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: '' },
        {
          type: 'span',
          data: {
            hName: 'span',
            hProperties: {},
          },
          children: [{ type: 'text', value: '' }],
        },
        { type: 'text', value: '' },
      ],
    })
  })

  it('wraps block content surrounded by [ ... ]{attrs} and preserves prefix/suffix text', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Before [lead ' },
            {
              type: 'strong',
              children: [{ type: 'text', value: 'bold' }],
            },
            { type: 'text', value: ' tail]{class="callout"}' },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Before ' },
        {
          type: 'span',
          data: {
            hName: 'span',
            hProperties: {
              className: ['callout'],
            },
          },
          children: [
            { type: 'text', value: 'lead ' },
            {
              type: 'strong',
              children: [{ type: 'text', value: 'bold' }],
            },
            { type: 'text', value: ' tail' },
          ],
        },
      ],
    })
  })

  it('ignores block span closures when there is no matching preceding [ text node', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'strong',
              children: [{ type: 'text', value: 'bold' }],
            },
            { type: 'text', value: ' tail]{class="callout"}' },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'strong',
          children: [{ type: 'text', value: 'bold' }],
        },
        { type: 'text', value: ' tail]{class="callout"}' },
      ],
    })
  })

  it('wraps block spans with an empty prefix and falls back to empty attrs when the block attr capture disappears', () => {
    const originalMatch = String.prototype.match
    const counts = {
      suffix: 0,
    }

    vi.spyOn(String.prototype, 'match').mockImplementation(function (
      this: string,
      matcher: any,
    ) {
      if (this.toString() === ' tail]{class="callout"}' && matcher instanceof RegExp) {
        counts.suffix += 1
        if (counts.suffix === 3) {
          return [']{class="callout"}'] as unknown as RegExpMatchArray
        }
      }

      return originalMatch.call(this, matcher as any)
    })

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '[' },
            {
              type: 'strong',
              children: [{ type: 'text', value: 'bold' }],
            },
            { type: 'text', value: ' tail]{class="callout"}' },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: '' },
        {
          type: 'span',
          data: {
            hName: 'span',
            hProperties: {},
          },
          children: [
            {
              type: 'strong',
              children: [{ type: 'text', value: 'bold' }],
            },
            { type: 'text', value: ' tail' },
          ],
        },
      ],
    })
  })

  it('applies inline attrs to the previous inline node and leaves leading attrs-only text untouched', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '{class="ignored"}' },
            {
              type: 'emphasis',
              data: {
                hProperties: {
                  className: ['old'],
                },
              },
              children: [{ type: 'text', value: 'focus' }],
            },
            { type: 'text', value: '{class="new" id="hero"}' },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: '{class="ignored"}' },
        {
          type: 'emphasis',
          data: {
            hProperties: {
              className: ['old', 'new'],
              id: 'hero',
            },
          },
          children: [{ type: 'text', value: 'focus' }],
        },
        { type: 'text', value: '' },
      ],
    })
  })

  it('applies inline attrs to a target without existing hProperties', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'emphasis',
              children: [{ type: 'text', value: 'focus' }],
            },
            { type: 'text', value: '{id="hero"}' },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'emphasis',
          data: {
            hProperties: {
              id: 'hero',
            },
          },
          children: [{ type: 'text', value: 'focus' }],
        },
        { type: 'text', value: '' },
      ],
    })
  })

  it('applies block attrs to the containing paragraph', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Hello\n{id="hero" class="lead"}' }],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hProperties: {
          id: 'hero',
          className: ['lead'],
        },
      },
      children: [{ type: 'text', value: 'Hello' }],
    })
  })

  it('merges block attrs into existing hProperties on the containing paragraph', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          data: {
            hProperties: {
              className: ['existing'],
            },
          },
          children: [{ type: 'text', value: 'Hello\n{id="hero"}' }],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hProperties: {
          className: ['existing'],
          id: 'hero',
        },
      },
      children: [{ type: 'text', value: 'Hello' }],
    })
  })

  it('applies generic attrs to custom blocks and skips admonition wrapper internals', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          data: {
            hName: 'details',
            hProperties: {
              className: ['mk-admonition'],
            },
          },
          children: [
            {
              type: 'paragraph',
              data: {
                hName: 'div',
                hProperties: {
                  className: ['mk-admonition-title'],
                },
              },
              children: [{ type: 'text', value: 'Title' }],
            },
            {
              type: 'paragraph',
              data: {
                hName: 'div',
                hProperties: {
                  className: ['mk-admonition-content'],
                },
              },
              children: [{ type: 'text', value: 'Body{id="outer"}' }],
            },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hName: 'details',
        hProperties: {
          className: ['mk-admonition'],
          id: 'outer',
        },
      },
      children: [
        {
          type: 'paragraph',
          data: {
            hName: 'div',
            hProperties: {
              className: ['mk-admonition-title'],
            },
          },
          children: [{ type: 'text', value: 'Title' }],
        },
        {
          type: 'paragraph',
          data: {
            hName: 'div',
            hProperties: {
              className: ['mk-admonition-content'],
            },
          },
          children: [{ type: 'text', value: 'Body' }],
        },
      ],
    })
  })

  it('escalates table cell attrs to the row or the table depending on the column overflow', () => {
    const rowAttrsTree = {
      type: 'root',
      children: [
        {
          type: 'table',
          children: [
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'H1' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'H2' }],
                },
              ],
            },
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'A1' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'A2' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'row{id="row"}' }],
                },
              ],
            },
          ],
        },
      ],
    }
    const tableAttrsTree = {
      type: 'root',
      children: [
        {
          type: 'table',
          children: [
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'H1' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'H2' }],
                },
              ],
            },
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'A1' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'A2' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'extra' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'table{id="table"}' }],
                },
              ],
            },
          ],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(rowAttrsTree)
    transform(tableAttrsTree)

    expect(rowAttrsTree.children[0].children[1]).toMatchObject({
      type: 'tableRow',
      data: {
        hProperties: {
          id: 'row',
        },
      },
    })
    expect(rowAttrsTree.children[0].children[1].children[2]).toEqual({
      type: 'tableCell',
      children: [{ type: 'text', value: 'row' }],
    })

    expect(tableAttrsTree.children[0]).toMatchObject({
      type: 'table',
      data: {
        hProperties: {
          id: 'table',
        },
      },
    })
    expect(tableAttrsTree.children[0].children[1].children[3]).toEqual({
      type: 'tableCell',
      children: [{ type: 'text', value: 'table' }],
    })
  })

  it('applies generic attrs to a preceding heading or code block title marker only when the previous sibling matches', () => {
    const headingTree = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 2,
          children: [{ type: 'text', value: 'Title' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '{id="heading"}' }],
        },
      ],
    }
    const codeTree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'ts',
          value: 'console.log(1)',
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '{id="code"}' }],
        },
      ],
    }
    const untouchedTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '{id="ignored"}' }],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(headingTree)
    transform(codeTree)
    transform(untouchedTree)

    expect(headingTree.children[0]).toMatchObject({
      type: 'heading',
      data: {
        hProperties: {
          id: 'heading',
        },
      },
    })
    expect(headingTree.children[1]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '' }],
    })

    expect(codeTree.children[0]).toMatchObject({
      type: 'code',
      data: {
        hProperties: {
          id: 'code',
        },
      },
    })
    expect(codeTree.children[1]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '' }],
    })

    expect(untouchedTree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'First paragraph' }],
    })
    expect(untouchedTree.children[1]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '{id="ignored"}' }],
    })
  })

  it('merges title attrs into existing heading properties and falls back to empty attrs for malformed generic captures', () => {
    const originalMatch = String.prototype.match
    let brokenGenericMatchCount = 0
    vi.spyOn(String.prototype, 'match').mockImplementation(function (
      this: string,
      matcher: any,
    ) {
      if (this.toString() === 'Body{broken}' && matcher instanceof RegExp) {
        brokenGenericMatchCount += 1
        if (brokenGenericMatchCount === 6) {
          return ['{broken}'] as unknown as RegExpMatchArray
        }
      }

      return originalMatch.call(this, matcher as any)
    })

    const headingTree = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 2,
          data: {
            hProperties: {
              className: ['existing'],
            },
          },
          children: [{ type: 'text', value: 'Title' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '{id="heading"}' }],
        },
      ],
    }
    const brokenCustomBlockTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          data: {
            hName: 'div',
          },
          children: [{ type: 'text', value: 'Body{broken}' }],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(headingTree)
    transform(brokenCustomBlockTree)

    expect(headingTree.children[0]).toMatchObject({
      type: 'heading',
      data: {
        hProperties: {
          className: ['existing'],
          id: 'heading',
        },
      },
    })
    expect(brokenCustomBlockTree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hName: 'div',
        hProperties: {},
      },
      children: [{ type: 'text', value: 'Body' }],
    })
  })

  it('falls back to empty attrs for malformed inline, block, and title captures', () => {
    const originalMatch = String.prototype.match
    const counts = {
      inline: 0,
      block: 0,
      title: 0,
    }

    vi.spyOn(String.prototype, 'match').mockImplementation(function (
      this: string,
      matcher: any,
    ) {
      const value = this.toString()

      if (value === '{broken-inline}' && matcher instanceof RegExp) {
        counts.inline += 1
        if (counts.inline === 4) {
          return ['{broken-inline}'] as unknown as RegExpMatchArray
        }
      }

      if (value === 'Hello\n{broken-block}' && matcher instanceof RegExp) {
        counts.block += 1
        if (counts.block === 5) {
          return ['{broken-block}'] as unknown as RegExpMatchArray
        }
      }

      if (value === '{broken-title}' && matcher instanceof RegExp) {
        counts.title += 1
        if (counts.title === 6) {
          return ['{broken-title}'] as unknown as RegExpMatchArray
        }
      }

      return originalMatch.call(this, matcher as any)
    })

    const inlineTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'emphasis',
              data: {
                hProperties: {
                  className: ['existing'],
                },
              },
              children: [{ type: 'text', value: 'focus' }],
            },
            { type: 'text', value: '{broken-inline}' },
          ],
        },
      ],
    }
    const blockTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          data: {
            hProperties: {
              className: ['existing'],
            },
          },
          children: [{ type: 'text', value: 'Hello\n{broken-block}' }],
        },
      ],
    }
    const titleTree = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 2,
          data: {
            hProperties: {
              className: ['existing'],
            },
          },
          children: [{ type: 'text', value: 'Title' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '{broken-title}' }],
        },
      ],
    }

    const transform = remarkAttrs() as any
    transform(inlineTree)
    transform(blockTree)
    transform(titleTree)

    expect(inlineTree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'emphasis',
          data: {
            hProperties: {
              className: ['existing'],
            },
          },
          children: [{ type: 'text', value: 'focus' }],
        },
        { type: 'text', value: '' },
      ],
    })

    expect(blockTree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hProperties: {
          className: ['existing'],
        },
      },
      children: [{ type: 'text', value: 'Hello' }],
    })

    expect(titleTree.children[0]).toEqual({
      type: 'heading',
      depth: 2,
      data: {
        hProperties: {
          className: ['existing'],
        },
      },
      children: [{ type: 'text', value: 'Title' }],
    })
    expect(titleTree.children[1]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '' }],
    })
  })
})
