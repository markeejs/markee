import MarkdownIt from 'markdown-it'
import { describe, expect, it, vi } from 'vitest'
import StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'

import directivePlugin from './plugin-directive.js'

type InternalBlockRule = {
  name: string
  fn: (
    state: InstanceType<typeof StateBlock>,
    startLine: number,
    endLine: number,
    silent: boolean,
  ) => boolean
}

function getBlockRule(md: MarkdownIt, name: string) {
  const rules = (
    md.block.ruler as typeof md.block.ruler & {
      __rules__: InternalBlockRule[]
    }
  ).__rules__
  return rules.find((rule) => rule.name === name)!.fn
}

describe('directivePlugin', () => {
  it('parses container and leaf directives, including nested labels and unclosed containers', () => {
    const md = new MarkdownIt().use(directivePlugin)
    const tokens = md.parse(
      [
        ':::note[Label [Nested]]{role="alert"}',
        ':::escaped[Label \\] Escaped]',
        ':::',
        'body',
        ':::',
        '',
        '::badge[Leaf]{data-label="value"}',
        '::plain',
        '',
        ':::open',
        'still open',
      ].join('\n'),
      {},
    )

    expect(
      tokens.find((token) => token.type === 'directive_container_open'),
    ).toMatchObject({
      meta: {
        name: 'note',
        label: 'Label [Nested]',
        fence: ':::',
      },
      attrs: { role: 'alert' },
      map: [0, 3],
    })
    expect(
      tokens.filter((token) => token.type === 'directive_container_open'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ label: 'Label \\] Escaped' }),
        }),
      ]),
    )
    expect(tokens.filter((token) => token.type === 'directive_leaf')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            name: 'badge',
            label: 'Leaf',
            fence: '::',
          }),
          attrs: { 'data-label': 'value' },
          map: [6, 7],
        }),
        expect.objectContaining({
          meta: expect.objectContaining({
            name: 'plain',
            label: undefined,
            fence: '::',
          }),
          attrs: null,
          map: [7, 8],
        }),
      ]),
    )
    expect(
      tokens.filter((token) => token.type === 'directive_container_open'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ name: 'open' }),
          map: [9, 12],
        }),
      ]),
    )
  })

  it('rejects invalid directive syntax and excessive indentation', () => {
    const md = new MarkdownIt().use(directivePlugin, {
      allowLeadingSpaces: 0,
    })
    const rendered = md.render(
      [
        ':single',
        ':::bad-',
        ':::also:::',
        ':::note trailing',
        ':::note[label\\',
        ':::no-close[attr',
        ':::note',
        '  body',
        'text',
        '::leaf:',
        '::leaf[',
        '::1bad',
        '::leaf extra',
        '  :::indented',
      ].join('\n'),
    )

    expect(rendered).toContain('<p>:single')
    expect(rendered).toContain(':::bad-')
    expect(rendered).toContain(':::also:::')
    expect(rendered).toContain(':::note trailing')
    expect(rendered).toContain(':::note[label<br>')
    expect(rendered).toContain(':::no-close[attr')
    expect(rendered).toContain('<div>')
    expect(rendered).toContain('<p>body')
    expect(rendered).toContain('::leaf:')
    expect(rendered).toContain('::leaf[')
    expect(rendered).toContain('::1bad')
    expect(rendered).toContain('::leaf extra')
    expect(rendered).toContain(':::indented')
  })

  it('rejects malformed attrs, unterminated attrs, and trailing content after closing fences', () => {
    const md = new MarkdownIt().use(directivePlugin)
    const rendered = md.render(
      [':::note{', 'body', '::: trailing', '', '::badge{'].join('\n'),
    )

    expect(rendered).toContain(':::note{')
    expect(rendered).toContain('::: trailing')
    expect(rendered).toContain('::badge{')
  })

  it('allows blank lines inside container directives before the closing fence', () => {
    const md = new MarkdownIt().use(directivePlugin)
    const tokens = md.parse([':::note', '', 'body', '', ':::'].join('\n'), {})

    expect(
      tokens.find((token) => token.type === 'directive_container_open'),
    ).toMatchObject({
      map: [0, 5],
    })
  })

  it('scans escaped and nested attrs before handing them to the attrs parser', async () => {
    vi.resetModules()
    const parseAttrs = vi.fn(() => ({ parsed: true }))
    vi.doMock('attributes-parser', () => ({
      default: parseAttrs,
    }))

    const [
      { default: MarkdownItDynamic },
      { default: directivePluginDynamic },
    ] = await Promise.all([
      import('markdown-it'),
      import('./plugin-directive.js'),
    ])

    const tokens = new MarkdownItDynamic()
      .use(directivePluginDynamic)
      .parse([':::note{data="a\\\\b" json={x}}', 'body', ':::'].join('\n'), {})

    expect(parseAttrs).toHaveBeenCalledWith('data="a\\\\b" json={x}')
    expect(
      tokens.find((token) => token.type === 'directive_container_open'),
    ).toMatchObject({
      attrs: { parsed: true },
    })
  })

  it('supports silent validation and stops scanning when indentation drops below the block indent', () => {
    const md = new MarkdownIt().use(directivePlugin)
    const containerRule = getBlockRule(md, 'directive_container')
    const leafRule = getBlockRule(md, 'directive_leaf')

    const silentContainerState = new StateBlock(':::note[label]', md, {}, [])

    expect(
      containerRule(
        silentContainerState,
        0,
        silentContainerState.lineMax,
        true,
      ),
    ).toBe(true)
    expect(silentContainerState.tokens).toEqual([])

    const silentLeafState = new StateBlock('::badge[label]', md, {}, [])

    expect(leafRule(silentLeafState, 0, silentLeafState.lineMax, true)).toBe(
      true,
    )
    expect(silentLeafState.tokens).toEqual([])

    const containerState = new StateBlock(
      [':::note', '  body', 'text'].join('\n'),
      md,
      {},
      [],
    )
    containerState.blkIndent = 2

    expect(
      containerRule(containerState, 0, containerState.lineMax, false),
    ).toBe(true)
    expect(
      containerState.tokens.find(
        (token) => token.type === 'directive_container_open',
      ),
    ).toMatchObject({
      map: [0, 4],
      meta: {
        kind: 'container',
        name: 'note',
      },
    })
    expect(containerState.line).toBe(3)
  })
})
