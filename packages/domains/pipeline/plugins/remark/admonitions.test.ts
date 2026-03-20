import { beforeEach, describe, expect, it } from 'vitest'

import { remarkAdmonitions } from './admonitions.js'

function text(value: string) {
  return { type: 'text', value } as const
}

function paragraph(children: any[], data?: Record<string, unknown>) {
  return { type: 'paragraph', children, ...(data ? { data } : {}) }
}

function directiveLabel(children: any[]) {
  return paragraph(children, { directiveLabel: true })
}

function containerDirective(
  name: string,
  options: {
    attributes?: Record<string, unknown>
    children?: any[]
    position?: any
  } = {},
) {
  return {
    type: 'containerDirective',
    name,
    attributes: options.attributes ?? {},
    children: options.children ?? [],
    position: options.position ?? { start: { offset: 10 } },
  }
}

function leafDirective(
  name: string,
  options: {
    attributes?: Record<string, unknown>
    children?: any[]
    position?: any
  } = {},
) {
  return {
    type: 'leafDirective',
    name,
    attributes: options.attributes ?? {},
    children: options.children ?? [],
    position: options.position ?? { start: { offset: 20 } },
  }
}

function runAdmonitions(
  tree: any,
  pluginConfig: { linkTabs?: boolean } | undefined = undefined,
) {
  const transform = remarkAdmonitions.call({
    data() {
      return {
        pluginConfig(plugin: string) {
          if (plugin === 'tabbedContent') {
            return pluginConfig
          }
          return undefined
        },
      }
    },
  } as any) as any

  transform(tree)
}

describe('remarkAdmonitions', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('transforms leaf directives into block containers with merged html attributes', () => {
    const tree = {
      type: 'root',
      children: [
        leafDirective('custom-box', {
          attributes: { id: 'hero', class: 'alpha' },
          children: [paragraph([text('Leaf body')])],
          position: { start: { offset: 3 } },
        }),
      ],
    }

    runAdmonitions(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hName: 'custom-box',
        hProperties: {
          id: 'hero',
          className: ['alpha'],
        },
      },
      children: [text(''), paragraph([text('Leaf body')])],
      position: { start: { offset: 3 } },
    })
  })

  it('drops directive labels from leaf directives and handles missing attributes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'leafDirective',
          name: 'custom-box',
          children: [
            directiveLabel([text('Ignored')]),
            paragraph([text('Leaf body')]),
          ],
          position: { start: { offset: 4 } },
        },
      ],
    }

    runAdmonitions(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      data: {
        hName: 'custom-box',
        hProperties: {},
      },
      children: [text(''), paragraph([text('Leaf body')])],
      position: { start: { offset: 4 } },
    })
  })

  it('builds default admonitions, applies title aliases, and excludes directive labels from content', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('tldr', {
          attributes: { id: 'note' },
          children: [paragraph([text('Body')])],
        }),
        containerDirective('faq', {
          children: [
            directiveLabel([
              text('Custom '),
              { type: 'emphasis', children: [text('Title')] },
            ]),
            paragraph([text('Answer')]),
          ],
        }),
      ],
    }

    runAdmonitions(tree)

    expect(tree.children[0]).toMatchObject({
      data: {
        hName: 'div',
        hProperties: {
          className: ['mk-admonition', 'mk-tldr'],
          id: 'note',
        },
      },
      children: [
        {
          data: {
            hName: 'div',
            hProperties: {
              className: ['mk-admonition-title'],
            },
          },
          children: [paragraph([text('TL;DR')])],
        },
        {
          data: {
            hName: 'div',
            hProperties: {
              className: ['mk-admonition-content'],
            },
          },
          children: [paragraph([text('Body')])],
        },
      ],
    })

    expect(tree.children[1]).toMatchObject({
      data: {
        hProperties: {
          className: ['mk-admonition', 'mk-faq'],
        },
      },
      children: [
        {
          children: [
            paragraph([
              text(''),
              {
                type: 'paragraph',
                data: { directiveLabel: true },
                children: [
                  text('Custom '),
                  { type: 'emphasis', children: [text('Title')] },
                ],
              },
            ]),
          ],
        },
        {
          children: [paragraph([text('Answer')])],
        },
      ],
    })
  })

  it('creates collapsible admonitions for collapsed and expanded variants', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('note', {
          attributes: { collapsed: 'false' },
          children: [paragraph([text('Open body')])],
        }),
        containerDirective('warning', {
          attributes: { collapsed: '' },
          children: [paragraph([text('Closed body')])],
        }),
      ],
    }

    runAdmonitions(tree)

    expect(tree.children[0]).toMatchObject({
      data: {
        hName: 'details',
        hProperties: {
          className: ['mk-admonition', 'mk-note'],
          open: true,
        },
      },
      children: [{ data: { hName: 'summary' } }, { data: { hName: 'div' } }],
    })
    expect(tree.children[1]).toMatchObject({
      data: {
        hName: 'details',
        hProperties: {
          className: ['mk-admonition', 'mk-warning'],
          open: false,
        },
      },
    })
  })

  it('treats draft, block, valid custom tags, and invalid names as block-like containers', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('draft', {
          attributes: { class: 'beta' },
          children: [paragraph([text('Draft body')])],
        }),
        containerDirective('summary', {
          children: [paragraph([text('Summary body')])],
        }),
        containerDirective('block', {
          children: [paragraph([text('Block body')])],
        }),
        containerDirective('bad-tag!', {
          children: [paragraph([text('Bad body')])],
        }),
      ],
    }

    runAdmonitions(tree)

    expect(tree.children[0]).toMatchObject({
      data: {
        hName: 'markee-draft',
        hProperties: {
          className: ['beta'],
        },
      },
      children: [text(''), paragraph([text('Draft body')])],
    })
    expect(tree.children[1]).toMatchObject({
      data: {
        hName: 'div',
        hProperties: {
          className: ['mk-admonition', 'mk-summary'],
        },
      },
      children: [
        {
          data: {
            hName: 'div',
            hProperties: {
              className: ['mk-admonition-title'],
            },
          },
          children: [paragraph([text('Summary')])],
        },
        {
          data: {
            hName: 'div',
            hProperties: {
              className: ['mk-admonition-content'],
            },
          },
          children: [paragraph([text('Summary body')])],
        },
      ],
    })
    expect(tree.children[2]).toMatchObject({
      data: {
        hName: 'div',
        hProperties: {
          className: ['mk-block'],
        },
      },
      children: [text(''), paragraph([text('Block body')])],
    })
    expect(tree.children[3]).toMatchObject({
      data: {
        hName: 'div',
        hProperties: {
          className: [],
        },
      },
      children: [text(''), paragraph([text('Bad body')])],
    })
  })

  it('groups linked tabs into markee-tabs and carries kind/link metadata into inputs and panels', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('tab', {
          attributes: { kind: 'info', linked: '' },
          position: { start: { offset: 111 } },
          children: [
            directiveLabel([text('First & second')]),
            paragraph([text('Panel 1')]),
          ],
        }),
        containerDirective('tab', {
          attributes: { kind: 'info' },
          children: [
            directiveLabel([text('Second tab')]),
            paragraph([text('Panel 2')]),
          ],
        }),
        paragraph([text('Stop grouping')]),
      ],
    }

    runAdmonitions(tree, { linkTabs: false })

    const grouped = tree.children[0]
    expect(grouped).toMatchObject({
      type: 'paragraph',
      data: {
        hName: 'markee-tabs',
        hProperties: {
          className: ['mk-admonition', 'mk-tabbed', 'mk-tab', ' mk-info'],
        },
      },
    })
    expect(grouped.children[0]).toMatchObject({
      data: {
        hName: 'div',
        hProperties: {
          className: [
            'mk-admonition-title',
            'mk-admonition-tabs',
            'mk-tabbed-tabs',
          ],
        },
      },
    })
    expect(grouped.children[0].children[0]).toMatchObject({
      data: {
        hName: 'input',
        hProperties: {
          'checked': true,
          'data-tab': 'First%20&%20second',
        },
      },
    })
    expect(grouped.children[0].children[1]).toMatchObject({
      data: {
        hName: 'label',
        hProperties: {
          className: ['mk-tabbed-title'],
          for: 'tab-111-0',
        },
      },
    })
    expect(grouped.children[1]).toMatchObject({
      data: {
        hName: 'input',
        hProperties: {
          'checked': true,
          'data-tab': 'First%20&%20second',
        },
      },
    })
    expect(grouped.children[2]).toMatchObject({
      data: {
        hProperties: {
          className: ['mk-admonition-content', 'mk-tabbed-content'],
        },
      },
    })
    expect(grouped.children[3]).toMatchObject({
      data: {
        hName: 'input',
        hProperties: {
          'data-tab': 'Second%20tab',
        },
      },
    })
    expect(grouped.children[4]).toMatchObject({
      data: {
        hProperties: {
          className: ['mk-admonition-content', 'mk-tabbed-content'],
        },
      },
    })
    expect(tree.children[1]).toEqual(paragraph([text('Stop grouping')]))
  })

  it('supports unlinked tabs, default linked tabs, and grouping through the end of siblings', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('tab', {
          attributes: { unlinked: '' },
          position: { start: { offset: 7 } },
          children: [
            directiveLabel([text('One')]),
            paragraph([text('Panel one')]),
          ],
        }),
        containerDirective('tab', {
          children: [
            directiveLabel([text('Two')]),
            paragraph([text('Panel two')]),
          ],
        }),
      ],
    }

    runAdmonitions(tree, { linkTabs: true })

    expect(tree.children).toHaveLength(1)
    const grouped = tree.children[0]
    expect(grouped).toMatchObject({
      data: {
        hName: 'markee-tabs',
      },
    })
    expect(grouped.children[0].children[0]).toMatchObject({
      data: {
        hProperties: {
          checked: true,
          className: ['mk-tabbed-label-input'],
          id: 'label-tab-7-0',
          name: 'label-tab-7',
          onchange: 'this.nextElementSibling.click();',
          type: 'radio',
        },
      },
    })
    expect(grouped.children[1]).toMatchObject({
      data: {
        hProperties: {
          checked: true,
          className: ['mk-tabbed-input'],
          id: 'tab-7-0',
          name: 'tab-7',
          type: 'radio',
        },
      },
    })
  })

  it('supports empty tab labels and extractText fallback nodes when grouping tabs', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('tab', {
          position: { start: { offset: 22 } },
          children: [directiveLabel([]), paragraph([text('Panel one')])],
        }),
        containerDirective('tab', {
          children: [
            directiveLabel([{ type: 'mystery' }, text('Two')]),
            paragraph([text('Panel two')]),
          ],
        }),
      ],
    }

    runAdmonitions(tree, { linkTabs: true })

    const grouped = tree.children[0]
    expect(grouped.children[0].children[0]).toMatchObject({
      data: {
        hProperties: {
          'data-tab': '',
        },
      },
    })
    expect(grouped.children[1]).toMatchObject({
      data: {
        hProperties: {
          'data-tab': '',
        },
      },
    })
    expect(grouped.children[0].children[2]).toMatchObject({
      data: {
        hProperties: {
          'data-tab': 'Two',
        },
      },
    })
    expect(grouped.children[3]).toMatchObject({
      data: {
        hProperties: {
          'data-tab': 'Two',
        },
      },
    })
  })

  it('renders a tab with an explicitly empty label title wrapper before grouping', () => {
    const tree = {
      type: 'root',
      children: [
        containerDirective('tab', {
          children: [directiveLabel([]), paragraph([text('Panel one')])],
        }),
        paragraph([text('Stop')]),
      ],
    }

    runAdmonitions(tree, { linkTabs: true })

    const grouped = tree.children[0]
    expect(grouped.children[0].children[1]).toMatchObject({
      data: {
        hName: 'label',
        hProperties: {
          className: ['mk-tabbed-title'],
        },
      },
      children: [],
    })
  })

  it('handles container directives without attributes or source offsets when grouping tabs', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'containerDirective',
          name: 'tab',
          children: [
            directiveLabel([text('Fallback')]),
            paragraph([text('Panel one')]),
          ],
        },
        {
          type: 'containerDirective',
          name: 'tab',
          children: [
            directiveLabel([text('Second')]),
            paragraph([text('Panel two')]),
          ],
        },
      ],
    }

    runAdmonitions(tree, { linkTabs: true })

    const grouped: any = tree.children[0]
    expect(grouped.data).toMatchObject({
      hName: 'markee-tabs',
      hProperties: {
        className: ['mk-admonition', 'mk-tabbed', 'mk-tab', ''],
      },
    })
    expect(grouped.children[0].children[0]).toMatchObject({
      data: {
        hProperties: {
          'id': 'label-tab-0-0',
          'name': 'label-tab-0',
          'data-tab': 'Fallback',
        },
      },
    })
    expect(grouped.children[1]).toMatchObject({
      data: {
        hProperties: {
          'id': 'tab-0-0',
          'name': 'tab-0',
          'data-tab': 'Fallback',
        },
      },
    })
  })
})
