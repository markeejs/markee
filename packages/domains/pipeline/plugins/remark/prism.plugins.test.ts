import { describe, expect, it, vi } from 'vitest'

const prismPluginState = vi.hoisted(() => ({
  loaded: [] as string[],
}))

vi.mock('prismjs/plugins/toolbar/prism-toolbar.js', () => {
  prismPluginState.loaded.push('toolbar')
  return {}
})
vi.mock('prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard.js', () => {
  prismPluginState.loaded.push('copy')
  return {}
})
vi.mock('prismjs/plugins/line-highlight/prism-line-highlight.js', () => {
  prismPluginState.loaded.push('line-highlight')
  return {}
})
vi.mock('prismjs/plugins/line-numbers/prism-line-numbers.js', () => {
  prismPluginState.loaded.push('line-numbers')
  return {}
})
vi.mock('prismjs/plugins/autolinker/prism-autolinker.js', () => {
  prismPluginState.loaded.push('autolinker')
  return {}
})
vi.mock('prismjs/components/prism-diff', () => {
  prismPluginState.loaded.push('diff')
  return {}
})
vi.mock('prismjs/plugins/diff-highlight/prism-diff-highlight.js', () => {
  prismPluginState.loaded.push('diff-highlight')
  return {}
})
vi.mock('prismjs/plugins/inline-color/prism-inline-color.js', () => {
  prismPluginState.loaded.push('inline-color')
  return {}
})

describe('prism.plugins', () => {
  it('loads the prism plugin side-effect modules', async () => {
    prismPluginState.loaded.length = 0
    vi.resetModules()

    await import('./prism.plugins.js')

    expect(prismPluginState.loaded).toEqual([
      'toolbar',
      'copy',
      'line-highlight',
      'line-numbers',
      'autolinker',
      'diff',
      'diff-highlight',
      'inline-color',
    ])
  })
})
