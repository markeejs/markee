import { describe, expect, it, vi } from 'vitest'

const searchPluginConfigValue = vi.hoisted(() => ({
  value: undefined as unknown,
}))

const searchState = vi.hoisted(() => ({
  $config: { get: vi.fn(() => ({ plugins: { demo: 'from-config' } })) },
}))

vi.mock('@markee/state', () => ({
  state: searchState,
}))

vi.mock('../plugins/remark/attrs.js', () => ({
  remarkAttrs: () => () => {},
}))
vi.mock('../plugins/remark/twemoji.js', () => {
  const remarkTwemoji = Object.assign(() => () => {}, {
    flagSupport: () => () => {},
  })
  return { remarkTwemoji }
})
vi.mock('../plugins/remark/abbreviations.js', () => ({
  remarkAbbreviations: () => () => {},
}))
vi.mock('../plugins/remark/accessible-headings.js', () => ({
  remarkAccessibleHeadings: () => () => {},
}))
vi.mock('../plugins/remark/directive-remove-leaf.js', () => ({
  remarkDirectiveRemoveLeaf: () => () => {},
}))
vi.mock('../plugins/remark/fontawesome.js', () => ({
  remarkFontAwesome: function (this: any) {
    searchPluginConfigValue.value = this.data('pluginConfig')('demo')
    return () => {}
  },
}))
vi.mock('../plugins/remark/material-icons.js', () => ({
  remarkMaterialIcons: () => () => {},
}))
vi.mock('../plugins/remark/simple-icons.js', () => ({
  remarkSimpleIcons: () => () => {},
}))
vi.mock('../plugins/remark/nested-html.js', () => ({
  remarkNestedHtml: () => (tree: any) => {
    for (const child of tree.children ?? []) {
      if (
        child.type === 'paragraph' &&
        child.children?.some(
          (node: any) =>
            node.type === 'text' && node.value?.includes('REMOVE_LABEL'),
        )
      ) {
        child.data = { directiveLabel: true }
      }
    }
  },
}))

import { searchPipeline } from './search'

describe('searchPipeline', () => {
  it('exposes plugin config through the search processor data', () => {
    expect(searchPipeline('Hello world')).toContain('<p>Hello world</p>')
    expect(searchPluginConfigValue.value).toBe('from-config')
  })

  it('removes paragraph content marked as directive metadata', () => {
    const html = searchPipeline('REMOVE_LABEL')

    expect(html).toContain('<p></p>')
    expect(html).not.toContain('REMOVE_LABEL')
  })

  it('removes excluded tags, aliases specific tags, and strips attributes', () => {
    const html = searchPipeline(`
<script>alert(1)</script>
<img src="/logo.png" alt="logo">
<details class="outer" style="color:red">
  <summary class="sum">Summary</summary>
  <a href="/docs" rel="noreferrer" target="_blank" class="link" style="font-weight:bold">Link</a>
  <i class="keep" style="color:red">Icon</i>
</details>
`)
    const compact = html.replace(/\s+/g, ' ')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(compact).toContain(
      '<div> <div>Summary</div> <span>Link</span> <i class="keep" style="color:red">Icon</i> </div>',
    )
    expect(html).not.toContain('href=')
    expect(html).not.toContain('rel=')
    expect(html).not.toContain('target=')
    expect(html).not.toContain('class="outer"')
    expect(html).not.toContain('class="sum"')
    expect(html).not.toContain('class="link"')
    expect(html).not.toContain('style="font-weight:bold"')
  })
})
