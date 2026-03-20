import { describe, expect, it, vi } from 'vitest'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'

vi.mock('unist-util-visit', async () => {
  const actual =
    await vi.importActual<typeof import('unist-util-visit')>('unist-util-visit')

  return {
    ...actual,
    visit(
      tree: unknown,
      test: unknown,
      visitor: (...args: unknown[]) => unknown,
    ) {
      if (
        (tree as { __triggerUndefinedArgs?: boolean }).__triggerUndefinedArgs
      ) {
        visitor({
          type: 'element',
          tagName: 'div',
          properties: {},
          children: [],
        })
      }

      return actual.visit(tree as never, test as never, visitor as never)
    },
  }
})

import { rehypeFootnoteOrdering } from './footnote-ordering.js'

describe('rehypeFootnoteOrdering', () => {
  it('keeps the visible footnote list in definition order while cleaning the generated html', async () => {
    const html = String(
      await unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeFootnoteOrdering)
        .use(rehypeStringify)
        .process(
          [
            '<p><sup dummy="true"><a href="#fn-a">1</a></sup><sup dummy="true"><a href="#fn-b">2</a></sup>Body</p>',
            '<section data-footnotes>',
            '<h2 id="footnote-label">Footnotes</h2>',
            '<ol>',
            '<li id="fn-a"><p>First footnote <a data-footnote-backref href="#fnref-a">↩</a><a data-footnote-backref href="#fnref-a-2">↩</a></p></li>',
            '<li id="fn-b"><p>Second footnote <a data-footnote-backref href="#fnref-b">↩</a></p></li>',
            '</ol>',
            '</section>',
          ].join(''),
        ),
    )

    expect(html).not.toContain('dummy="true"')
    expect(html).toContain('<h3 id="footnote-label">Footnotes</h3>')
    expect(html.indexOf('First footnote')).toBeLessThan(
      html.indexOf('Second footnote'),
    )
    expect(html).not.toContain('fnref-a-2')
    expect(html).not.toContain('fnref-b')
  })

  it('removes dummy references, demotes the heading, and trims double backrefs', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'sup',
              properties: { dummy: 'true' },
              children: [],
            },
            {
              type: 'element',
              tagName: 'h2',
              properties: { id: 'footnote-label' },
              children: [],
            },
            {
              type: 'element',
              tagName: 'a',
              properties: { dataFootnoteBackref: '' },
              children: [
                { type: 'text', value: 'Back' },
                { type: 'text', value: 'Again' },
              ],
            },
          ],
        },
      ],
    } as const

    const transform = rehypeFootnoteOrdering() as any
    transform(tree)

    const container = tree.children[0]
    expect(container.children).toHaveLength(2)
    expect(container.children[0]).toMatchObject({
      tagName: 'h3',
      properties: { id: 'footnote-label' },
    })
    expect(container.children[1]).toMatchObject({
      tagName: 'a',
      children: [{ type: 'text', value: 'Back' }],
    })
  })

  it('removes lone backrefs and ignores nodes without a parent or index', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { dataFootnoteBackref: '' },
          children: [{ type: 'text', value: 'Back' }],
        },
        {
          type: 'element',
          tagName: 'a',
          properties: { dataFootnoteBackref: '' },
          children: [
            { type: 'text', value: 'Keep' },
            { type: 'text', value: 'Extra' },
            { type: 'text', value: 'Third' },
          ],
        },
      ],
      __triggerUndefinedArgs: true,
    } as const

    const transform = rehypeFootnoteOrdering() as any
    transform(tree)
    expect(tree.children).toEqual([
      {
        type: 'element',
        tagName: 'a',
        properties: { dataFootnoteBackref: '' },
        children: [
          { type: 'text', value: 'Keep' },
          { type: 'text', value: 'Extra' },
          { type: 'text', value: 'Third' },
        ],
      },
    ])

    expect(() =>
      transform({
        type: 'root',
        children: [],
      }),
    ).not.toThrow()
  })
})
