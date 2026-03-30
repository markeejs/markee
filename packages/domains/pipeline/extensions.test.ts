import { describe, expect, it, vi } from 'vitest'

let extensionId = 0

async function importExtensions() {
  vi.resetModules()
  return import('./extensions')
}

describe('extensions', () => {
  it('registers and applies remark extensions', async () => {
    const { markdownPipeline, withRemarkExtensions } = await importExtensions()
    const plugin = () => () => {}
    const base = { use: vi.fn().mockReturnThis() }
    const key = `remark-${extensionId++}`

    ;(markdownPipeline as any).remark(key, plugin, 'alpha', 2)
    withRemarkExtensions(base)

    expect(markdownPipeline.visit).toBeTypeOf('function')
    expect(base.use).toHaveBeenCalledWith(plugin, 'alpha', 2)
  })

  it('registers and applies rehype extensions', async () => {
    const { markdownPipeline, withRehypeExtensions } = await importExtensions()
    const plugin = () => () => {}
    const base = { use: vi.fn().mockReturnThis() }
    const key = `rehype-${extensionId++}`

    ;(markdownPipeline as any).rehype(key, plugin, { enabled: true })
    withRehypeExtensions(base)

    expect(base.use).toHaveBeenCalledWith(plugin, { enabled: true })
  })
})
