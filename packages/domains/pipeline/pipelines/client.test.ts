import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientState = vi.hoisted(() => ({
  $config: { get: vi.fn() },
  $navigation: { get: vi.fn() },
}))

vi.mock('@markee/state', () => ({
  state: clientState,
}))

vi.mock('../plugins/remark/attrs.js', () => ({
  remarkAttrs: () => () => {},
}))
vi.mock('../plugins/remark/prism.js', () => ({
  remarkPrism: () => () => {},
}))
vi.mock('../plugins/remark/lightbox.js', () => ({
  remarkLightbox: () => () => {},
}))
vi.mock('../plugins/remark/nested-html.js', () => ({
  remarkNestedHtml: () => (tree: any) => {
    for (const child of tree.children ?? []) {
      if (child.type === 'code') {
        child.data = {
          ...child.data,
          hProperties: {
            existing: 'true',
            ...child.data?.hProperties,
          },
        }
      }
    }
  },
}))
vi.mock('../plugins/remark/admonitions.js', () => ({
  remarkAdmonitions: () => () => {},
}))
vi.mock('../plugins/remark/ins-and-mark.js', () => ({
  remarkInsAndMark: () => () => {},
}))
vi.mock('../plugins/remark/abbreviations.js', () => ({
  remarkAbbreviations: () => () => {},
}))
vi.mock('../plugins/remark/footnote-ordering.js', () => ({
  remarkFootnoteOrdering: () => () => {},
}))
vi.mock('../plugins/remark/accessible-headings.js', () => ({
  remarkAccessibleHeadings: () => () => {},
}))
vi.mock('../plugins/remark/html-escape-sequences.js', () => ({
  remarkHtmlEscapeSequences: () => () => {},
}))
vi.mock('../plugins/remark/directive-remove-leaf.js', () => ({
  remarkDirectiveRemoveLeaf: () => () => {},
}))
vi.mock('../plugins/rehype/prism.js', () => ({
  rehypePrism: () => () => {},
}))
vi.mock('../plugins/rehype/tasklist.js', () => ({
  rehypeTasklist: () => () => {},
}))
vi.mock('../plugins/rehype/table-merge.js', () => ({
  rehypeTableMerge: () => () => {},
}))
vi.mock('../plugins/rehype/footnote-ordering.js', () => ({
  rehypeFootnoteOrdering: () => () => {},
}))
vi.mock('../plugins/remark/fontawesome.js', () => ({
  remarkFontAwesome: () => () => {},
}))
vi.mock('../plugins/remark/material-icons.js', () => ({
  remarkMaterialIcons: () => () => {},
}))
vi.mock('../plugins/remark/simple-icons.js', () => ({
  remarkSimpleIcons: () => () => {},
}))
vi.mock('../plugins/remark/twemoji.js', () => {
  const remarkTwemoji = Object.assign(() => () => {}, {
    flagSupport: () => () => {},
  })
  return { remarkTwemoji }
})

import * as extensions from '../extensions'
import { markdownPipeline } from '../extensions'
import { clientPipeline, ensureTitle } from './client'

let extensionId = 0

describe('clientPipeline', () => {
  beforeEach(() => {
    clientState.$config.get.mockReturnValue({})
    clientState.$navigation.get.mockReturnValue({
      files: {
        '/doc': {
          frontMatter: {},
        },
      },
    })
  })

  it('prepends a title only when one is missing from the html', () => {
    expect(ensureTitle('<p>Hello</p>', 'Title')).toBe(
      '<h2>Title</h2>\n<p>Hello</p>',
    )
    expect(ensureTitle('<h2>Existing</h2><p>Hello</p>', 'Title')).toBe(
      '<h2>Existing</h2><p>Hello</p>',
    )
    expect(ensureTitle('<p>Hello</p>')).toBe('<p>Hello</p>')
  })

  it('processes markdown and prepends the ensured title', async () => {
    const html = await clientPipeline('Hello world', 'Welcome', '/doc')

    expect(html).toContain('<h2>Welcome</h2>')
    expect(html).toContain('<p>Hello world</p>')
  })

  it('passes config, front matter, and pluginConfig through remark extensions', async () => {
    const key = `client-${extensionId++}`
    let captured:
      | {
          config: unknown
          frontMatter: unknown
          pluginConfig: (plugin: string) => unknown
        }
      | undefined

    markdownPipeline.remark(key, function (this: any) {
      captured = {
        config: this.data('config'),
        frontMatter: this.data('frontMatter'),
        pluginConfig: this.data('pluginConfig'),
      }
      return () => {}
    })

    clientState.$config.get.mockReturnValue({
      plugins: {
        demo: 'from-config',
      },
    })
    clientState.$navigation.get.mockReturnValue({
      files: {
        '/doc': {
          frontMatter: {
            plugins: {
              demo: 'from-frontmatter',
            },
          },
        },
      },
    })

    const html = await clientPipeline(
      '```ts {class="alpha beta" data-mode="live"}\nconsole.log(1)\n```',
      undefined,
      '/doc',
    )

    expect(html).toContain('data-mode="live"')
    expect(captured?.config).toEqual({
      plugins: {
        demo: 'from-config',
      },
    })
    expect(captured?.frontMatter).toEqual({
      plugins: {
        demo: 'from-frontmatter',
      },
    })
    expect(captured?.pluginConfig('demo')).toBe('from-frontmatter')
    expect(captured?.pluginConfig('missing')).toBeUndefined()
  })

  it('falls back to empty front matter and supports code blocks without meta', async () => {
    const key = `client-${extensionId++}`
    let capturedFrontMatter: unknown

    ;(markdownPipeline as any).remark(key, function (this: any) {
      capturedFrontMatter = this.data('frontMatter')
      return () => {}
    })

    clientState.$navigation.get.mockReturnValue({
      files: {},
    })

    const html = await clientPipeline(
      '```ts\nconsole.log(1)\n```',
      'Code',
      '/missing',
    )

    expect(capturedFrontMatter).toEqual({})
    expect(html).toContain('<h2>Code</h2>')
    expect(html).toContain('console.log(1)')
  })

  it('returns an empty string when processing throws', async () => {
    vi.spyOn(extensions, 'withRemarkExtensions').mockImplementation(() => {
      throw new Error('boom')
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(
      clientPipeline('Hello world', 'Welcome', '/doc'),
    ).resolves.toBe('')
    expect(logSpy).toHaveBeenCalled()
  })
})
