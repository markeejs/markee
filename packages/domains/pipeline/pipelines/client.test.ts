import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientState = vi.hoisted(() => ({
  $config: { get: vi.fn() },
  $navigation: { get: vi.fn() },
}))

const lazyPluginImports = vi.hoisted(() => ({
  abbreviations: 0,
  admonitions: 0,
  directive: 0,
  directiveRemoveLeaf: 0,
  fontawesome: 0,
  footnoteRehype: 0,
  footnoteRemark: 0,
  insAndMark: 0,
  lightbox: 0,
  material: 0,
  prism: 0,
  rehypePrism: 0,
  simple: 0,
  tableMerge: 0,
  tasklist: 0,
}))

vi.mock('@markee/state', () => ({
  state: clientState,
}))

vi.mock('../plugins/remark/attrs.js', () => ({
  remarkAttrs: () => () => {},
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
vi.mock('../plugins/remark/admonitions.js', () => {
  lazyPluginImports.admonitions += 1
  return {
    remarkAdmonitions: () => () => {},
  }
})
vi.mock('../plugins/remark/ins-and-mark.js', () => {
  lazyPluginImports.insAndMark += 1
  return {
    remarkInsAndMark: () => () => {},
  }
})
vi.mock('../plugins/remark/abbreviations.js', () => {
  lazyPluginImports.abbreviations += 1
  return {
    remarkAbbreviations: () => () => {},
  }
})
vi.mock('../plugins/remark/footnote-ordering.js', () => {
  lazyPluginImports.footnoteRemark += 1
  return {
    remarkFootnoteOrdering: () => () => {},
  }
})
vi.mock('../plugins/remark/accessible-headings.js', () => ({
  remarkAccessibleHeadings: () => () => {},
}))
vi.mock('../plugins/remark/html-escape-sequences.js', () => ({
  remarkHtmlEscapeSequences: () => () => {},
}))
vi.mock('../plugins/remark/directive-remove-leaf.js', () => {
  lazyPluginImports.directiveRemoveLeaf += 1
  return {
    remarkDirectiveRemoveLeaf: () => () => {},
  }
})
vi.mock('remark-directive', () => {
  lazyPluginImports.directive += 1
  return {
    default: () => () => {},
  }
})
vi.mock('../plugins/rehype/prism.js', () => {
  lazyPluginImports.rehypePrism += 1
  return {
    rehypePrism: () => () => {},
  }
})
vi.mock('../plugins/rehype/tasklist.js', () => {
  lazyPluginImports.tasklist += 1
  return {
    rehypeTasklist: () => () => {},
  }
})
vi.mock('../plugins/rehype/table-merge.js', () => {
  lazyPluginImports.tableMerge += 1
  return {
    rehypeTableMerge: () => () => {},
  }
})
vi.mock('../plugins/rehype/footnote-ordering.js', () => {
  lazyPluginImports.footnoteRehype += 1
  return {
    rehypeFootnoteOrdering: () => () => {},
  }
})
vi.mock('../plugins/remark/fontawesome.js', () => {
  lazyPluginImports.fontawesome += 1
  return {
    remarkFontAwesome: () => () => {},
  }
})
vi.mock('../plugins/remark/material-icons.js', () => {
  lazyPluginImports.material += 1
  return {
    remarkMaterialIcons: () => () => {},
  }
})
vi.mock('../plugins/remark/simple-icons.js', () => {
  lazyPluginImports.simple += 1
  return {
    remarkSimpleIcons: () => () => {},
  }
})
vi.mock('../plugins/remark/prism.js', () => {
  lazyPluginImports.prism += 1
  return {
    remarkPrism: () => () => {},
  }
})
vi.mock('../plugins/remark/lightbox.js', () => {
  lazyPluginImports.lightbox += 1
  return {
    remarkLightbox: () => () => {},
  }
})
vi.mock('../plugins/remark/twemoji.js', () => {
  const remarkTwemoji = Object.assign(() => () => {}, {
    flagSupport: () => () => {},
  })
  return { remarkTwemoji }
})

import { markdownPipeline } from '../extensions'

let extensionId = 0

async function importClient() {
  return import('./client')
}

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
    lazyPluginImports.abbreviations = 0
    lazyPluginImports.admonitions = 0
    lazyPluginImports.directive = 0
    lazyPluginImports.directiveRemoveLeaf = 0
    lazyPluginImports.fontawesome = 0
    lazyPluginImports.footnoteRehype = 0
    lazyPluginImports.footnoteRemark = 0
    lazyPluginImports.insAndMark = 0
    lazyPluginImports.lightbox = 0
    lazyPluginImports.material = 0
    lazyPluginImports.prism = 0
    lazyPluginImports.rehypePrism = 0
    lazyPluginImports.simple = 0
    lazyPluginImports.tableMerge = 0
    lazyPluginImports.tasklist = 0
  })

  it('prepends a title only when one is missing from the html', async () => {
    const { ensureTitle } = await importClient()

    expect(ensureTitle('<p>Hello</p>', 'Title')).toBe(
      '<h2>Title</h2>\n<p>Hello</p>',
    )
    expect(ensureTitle('<h2>Existing</h2><p>Hello</p>', 'Title')).toBe(
      '<h2>Existing</h2><p>Hello</p>',
    )
    expect(ensureTitle('<p>Hello</p>')).toBe('<p>Hello</p>')
  })

  it('processes markdown and prepends the ensured title', async () => {
    const { clientPipeline } = await importClient()
    const html = await clientPipeline('Hello world', 'Welcome', '/doc')

    expect(html).toContain('<h2>Welcome</h2>')
    expect(html).toContain('<p>Hello world</p>')
  })

  it('passes config, front matter, and pluginConfig through remark extensions', async () => {
    const { clientPipeline } = await importClient()
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
    const { clientPipeline } = await importClient()
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

  it('skips syntax-aware icon imports when the content does not reference them', async () => {
    vi.resetModules()
    const { clientPipeline } = await importClient()

    await clientPipeline(
      ['| A | B |', '| - | - |', '| C | D |'].join('\n'),
      'Welcome',
      '/doc',
    )

    expect(lazyPluginImports).toEqual({
      abbreviations: 0,
      admonitions: 0,
      directive: 0,
      directiveRemoveLeaf: 0,
      fontawesome: 0,
      footnoteRehype: 0,
      footnoteRemark: 0,
      insAndMark: 0,
      lightbox: 0,
      material: 0,
      prism: 0,
      rehypePrism: 0,
      simple: 0,
      tableMerge: 0,
      tasklist: 0,
    })
  })

  it('lazy-loads only the syntax-aware icon plugins used by the content', async () => {
    vi.resetModules()
    const { clientPipeline } = await importClient()

    await clientPipeline(
      ':fontawesome-heart: :material-home: :simple-github:',
      'Icons',
      '/doc',
    )

    expect(lazyPluginImports).toEqual({
      abbreviations: 0,
      admonitions: 0,
      directive: 0,
      directiveRemoveLeaf: 0,
      fontawesome: 1,
      footnoteRehype: 0,
      footnoteRemark: 0,
      insAndMark: 0,
      lightbox: 0,
      material: 1,
      prism: 0,
      rehypePrism: 0,
      simple: 1,
      tableMerge: 0,
      tasklist: 0,
    })
  })

  it('also lazy-loads tasklist when any bracket syntax is present', async () => {
    vi.resetModules()
    const prismImports = {
      remark: 0,
      rehype: 0,
    }

    vi.doMock('../plugins/remark/prism.js', () => {
      prismImports.remark += 1
      return {
        remarkPrism: () => () => {},
      }
    })
    vi.doMock('../plugins/rehype/prism.js', () => {
      prismImports.rehype += 1
      return {
        rehypePrism: () => () => {},
      }
    })

    const { clientPipeline } = await importClient()

    await clientPipeline(
      [
        ':::note',
        'Body',
        ':::',
        '',
        '```ts',
        'console.log(1)',
        '```',
        '',
        '![Alt](./image.png)',
        '',
        '[^note]',
        '',
        '[^note]: Footnote',
      ].join('\n'),
      'Features',
      '/doc',
    )

    expect(lazyPluginImports).toEqual({
      abbreviations: 0,
      admonitions: 1,
      directive: 1,
      directiveRemoveLeaf: 1,
      fontawesome: 0,
      footnoteRehype: 1,
      footnoteRemark: 1,
      insAndMark: 0,
      lightbox: 1,
      material: 0,
      prism: 0,
      rehypePrism: 0,
      simple: 0,
      tableMerge: 0,
      tasklist: 1,
    })
    expect(prismImports).toEqual({
      remark: 1,
      rehype: 1,
    })
  })

  it('lazy-loads abbreviations, ins-mark, and table-merge when their syntax is present', async () => {
    vi.resetModules()
    const { clientPipeline } = await importClient()

    await clientPipeline(
      [
        '*[HTML]: HyperText Markup Language',
        '',
        'HTML',
        '',
        '==marked== ++inserted++',
        '',
        '- [x] done',
        '',
        '| A | B |',
        '| - | - |',
        '| ^ | > |',
      ].join('\n'),
      'Syntax',
      '/doc',
    )

    expect(lazyPluginImports).toEqual(
      expect.objectContaining({
        abbreviations: 1,
        admonitions: 0,
        directive: 0,
        directiveRemoveLeaf: 0,
        fontawesome: 0,
        footnoteRehype: 0,
        footnoteRemark: 0,
        insAndMark: 1,
        lightbox: 0,
        material: 0,
        prism: 0,
        rehypePrism: 0,
        simple: 0,
        tableMerge: 1,
      }),
    )
  })

  it('returns an empty string when processing throws', async () => {
    vi.resetModules()
    const freshExtensions = await import('../extensions')
    const { clientPipeline } = await importClient()
    vi.spyOn(freshExtensions, 'withRemarkExtensions').mockImplementation(() => {
      throw new Error('boom')
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(
      clientPipeline('Hello world', 'Welcome', '/doc'),
    ).resolves.toBe('')
    expect(logSpy).toHaveBeenCalled()
  })
})
