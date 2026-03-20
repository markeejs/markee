import MarkdownIt from 'markdown-it'
import Attr from 'markdown-it-attrs'
import FM from 'markdown-it-front-matter'
import { describe, expect, it, vi } from 'vitest'

import Directives from './plugin-directive.js'
import { retokenize } from './helper-retokenize.js'

const markdownIt = new MarkdownIt()
  .use(FM, () => {})
  .use(Attr)
  .use(Directives)

describe('retokenize', () => {
  it('rebuilds rich token metadata for headings, tables, directives, fences, and raw gaps', () => {
    const source = [
      '---',
      'title: Example',
      '---',
      '',
      '# Heading {#custom}',
      '',
      'Paragraph with [doc](./guide.md){version=latest} and <img src="./image.jpg" />.',
      '',
      '| Name | Link |',
      '| --- | --- |',
      '| A | [cell](./table.md) |',
      '',
      ':::note[Label]{role=alert}',
      'Body [inside](./inside.md)',
      ':::',
      '',
      '::badge[Leaf]{tone=positive}',
      '',
      '```ts title="Code"',
      '// [comment](./code.md)',
      'const ignored = "[nope](./ignored.md)"',
      '```',
      '',
      '[ref]: ./reference.md',
    ].join('\n')

    const tokens = retokenize(markdownIt.parse(source, {}), source)

    const heading = tokens.find((token) => token.tag === 'h1')
    const table = tokens.find((token) => token.tag === 'table')
    const directive = tokens.find(
      (token) => token.type === 'directive_container_open',
    )
    const leaf = tokens.find((token) => token.type === 'directive_leaf')
    const fence = tokens.find((token) => token.type === 'fence')
    const meta = tokens.find((token) => token.type === 'meta')
    const inline = tokens.find(
      (token) =>
        token.type === 'inline' && token.raw.includes('[doc](./guide.md)'),
    )

    expect(heading).toMatchObject({
      title: 'Heading',
      attrs: { id: 'custom' },
    })
    expect(table).toMatchObject({
      type: 'inline',
      tag: 'table',
    })
    expect(directive).toMatchObject({
      meta: { name: 'note', label: 'Label' },
      attrs: { role: 'alert' },
    })
    expect(leaf).toMatchObject({
      meta: { name: 'badge', label: 'Leaf' },
      attrs: { tone: 'positive' },
    })
    expect(fence).toMatchObject({
      lang: 'ts',
      attrs: { title: 'Code' },
    })
    expect(inline?.links).toEqual([
      expect.objectContaining({
        url: './guide.md',
        line: 6,
        attrs: { version: 'latest' },
      }),
      expect.objectContaining({
        url: './image.jpg',
        line: 6,
        attrs: undefined,
      }),
    ])
    expect(fence?.links).toEqual([
      expect.objectContaining({
        url: './code.md',
        attrs: undefined,
      }),
    ])
    expect(meta?.links).toEqual([
      expect.objectContaining({
        url: './reference.md',
        attrs: undefined,
      }),
    ])
  })

  it('tracks meta offsets, leaf directives, and html-comment links inside markdown fences', () => {
    const source = [
      '> quote',
      '',
      '::badge[Leaf]',
      '',
      '```html',
      '<!-- [doc](./commented.md) -->',
      '<div>ignored</div>',
      '```',
    ].join('\n')

    const tokens = retokenize(markdownIt.parse(source, {}), source)
    const leaf = tokens.find((token) => token.type === 'directive_leaf')
    const fence = tokens.find((token) => token.type === 'fence')

    expect(leaf).toMatchObject({
      content: '::badge[Leaf]',
      contentOffset: [0],
    })
    expect(fence?.links).toEqual([
      expect.objectContaining({
        url: './commented.md',
      }),
    ])
  })

  it('rebases meta content inside enclosing blocks to the matching inline offset', () => {
    const source = ['> quote', '>', '> [ref]: ./inside.md'].join('\n')

    const tokens = retokenize(markdownIt.parse(source, {}), source)
    const meta = tokens.find((token) => token.type === 'meta')

    expect(meta).toMatchObject({
      content: '[ref]: ./inside.md',
      contentOffset: 2,
    })
  })

  it('falls back to empty fence attrs when attribute parsing fails', () => {
    const source = ['```ts {', 'const a = 1', '```'].join('\n')

    const tokens = retokenize(markdownIt.parse(source, {}), source)
    const fence = tokens.find((token) => token.type === 'fence')

    expect(fence).toMatchObject({
      lang: 'ts',
      attrs: {},
    })
  })

  it('falls back to empty fence attrs when the attrs parser throws', async () => {
    vi.resetModules()
    vi.doMock('attributes-parser', () => ({
      default: () => {
        throw new Error('bad attrs')
      },
    }))

    const [{ default: MarkdownItDynamic }, { retokenize: retokenizeDynamic }] =
      await Promise.all([
        import('markdown-it'),
        import('./helper-retokenize.js'),
      ])

    const tokens = retokenizeDynamic(
      new MarkdownItDynamic().parse(
        ['```ts title="x"', 'body', '```'].join('\n'),
        {},
      ),
      ['```ts title="x"', 'body', '```'].join('\n'),
    )
    const fence = tokens.find((token) => token.type === 'fence')

    expect(fence).toMatchObject({
      lang: 'ts',
      attrs: {},
    })
  })

  it('extracts heading titles even when the heading has no attrs', () => {
    const source = '# Plain heading\n'

    const tokens = retokenize(markdownIt.parse(source, {}), source)
    const heading = tokens.find((token) => token.tag === 'h1')

    expect(heading).toMatchObject({
      title: 'Plain heading',
      attrs: {},
    })
  })
})
