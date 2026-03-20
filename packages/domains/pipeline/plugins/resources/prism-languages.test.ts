import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('prism-languages', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('loads the common prism bundle for common languages', async () => {
    const Prism = (await import('prismjs')).default
    const { loadLanguage } = await import('./prism-languages.js')

    expect(Prism.languages.typescript).toBeUndefined()
    expect(Prism.languages.rust).toBeUndefined()

    await loadLanguage('css')

    expect(Prism.languages.css).toBeDefined()
    expect(Prism.languages.typescript).toBeDefined()
    expect(Prism.languages.rust).toBeUndefined()
  })

  it('loads the secondary prism bundle for non-common languages', async () => {
    const Prism = (await import('prismjs')).default
    const { loadLanguage } = await import('./prism-languages.js')

    await loadLanguage('rust')

    expect(Prism.languages.css).toBeDefined()
    expect(Prism.languages.rust).toBeDefined()
  })
})
