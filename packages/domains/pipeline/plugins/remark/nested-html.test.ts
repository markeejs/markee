import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkParser from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'

import { remarkNestedHtml } from './nested-html.js'

async function render(markdown: string) {
  return String(
    await unified()
      .use(remarkParser)
      .use(remarkGfm)
      .use(remarkNestedHtml)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeStringify)
      .process(markdown),
  )
}

describe('remarkNestedHtml', () => {
  it('leaves isolated opening tags, isolated closing tags, and comment-only fragments untouched', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'html', value: '<div>' },
        { type: 'html', value: '</div>' },
        { type: 'html', value: '<!-- comment only -->' },
      ],
    }

    const transform = remarkNestedHtml() as any
    transform(tree)

    expect(tree.children).toEqual([
      { type: 'html', value: '<div>' },
      { type: 'html', value: '</div>' },
      { type: 'html', value: '<!-- comment only -->' },
    ])
  })

  it('parses markdown inside html blocks, preserves comments, and skips untouched code nodes', async () => {
    const html = await render(
      [
        '<div>',
        '  <!-- kept comment -->',
        '  <p>This **works**</p>',
        '  <code>But **this** stays literal</code>',
        '  <div><p>And ~~this~~ too</p></div>',
        '</div>',
      ].join('\n'),
    )

    expect(html).toContain('<!-- kept comment -->')
    expect(html).toContain('<p>This <strong>works</strong></p>')
    expect(html).toContain('<code>But **this** stays literal</code>')
    expect(html).toContain('<p>And <del>this</del> too</p>')
  })

  it('supports nested fenced code blocks inside html and parses top-level fragment text', async () => {
    const html = await render(
      [
        '<div>',
        '  ```markdown',
        '  **Nested code blocks work**',
        '  ```',
        '</div>',
        'Tail **text**',
      ].join('\n'),
    )

    expect(html).toContain(
      '<pre><code class="language-markdown">**Nested code blocks work**',
    )
    expect(html).toContain('<p>Tail <strong>text</strong></p>')
  })

  it('skips markdown parsing inside pristine roots', async () => {
    const html = await render(
      [
        '<p data-pristine>',
        "  <span>**won't** parse</span>",
        '  <span><i>HTML still works</i></span>',
        '</p>',
      ].join('\n'),
    )

    expect(html).toContain('<p data-pristine="">')
    expect(html).toContain("<span>**won't** parse</span>")
    expect(html).not.toContain("<strong>won't</strong>")
    expect(html).toContain('<i>HTML still works</i>')
  })

  it('keeps untouched root nodes like style and void elements as html', async () => {
    const styleHtml = await render('<style>.x { color: red; }</style>')
    const voidHtml = await render('<br>')

    expect(styleHtml).toContain('<style>.x { color: red; }</style>')
    expect(voidHtml).toContain('<br>')
  })

  it('adds data to parsed elements while leaving elements without text content unchanged', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'html',
          value: '<div><span></span><p>**bold**</p></div>',
        },
      ],
    }

    const transform = remarkNestedHtml() as any
    transform(tree)

    const fragment = tree.children[0] as any
    expect(fragment.type).toBe('root')
    expect(fragment.children[0]).toMatchObject({
      type: 'element',
      tagName: 'div',
      data: {
        hName: 'div',
      },
    })
    expect(fragment.children[0].children[0]).toMatchObject({
      type: 'element',
      tagName: 'span',
      children: [],
      data: {
        hName: 'span',
      },
    })
    expect(fragment.children[0].children[1]).toMatchObject({
      type: 'element',
      tagName: 'p',
      data: {
        hName: 'p',
      },
    })
  })
})
