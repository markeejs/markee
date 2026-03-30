import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('reveal.js/dist/reveal.css?raw', () => ({
  default: '.reveal-core{}',
}))
vi.mock('reveal.js/dist/theme/simple.css?raw', () => ({
  default: '.reveal-theme{}',
}))
vi.mock('./index.css?raw', () => ({
  default: '.reveal-local{}',
}))

describe('@markee/revealjs styles', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('injects the reveal core, theme, and local styles once', async () => {
    const { loadRevealStyles } = await import('./styles.js')

    await loadRevealStyles()
    await loadRevealStyles()

    const style = document.getElementById(
      'markee-revealjs-styles',
    ) as HTMLStyleElement
    expect(style).not.toBeNull()
    expect(style.innerHTML).toContain('.reveal-core{}')
    expect(style.innerHTML).toContain('.reveal-theme{}')
    expect(style.innerHTML).toContain('.reveal-local{}')
    expect(document.querySelectorAll('#markee-revealjs-styles')).toHaveLength(1)
  })

  it('skips injection when styles appear while the imports are resolving', async () => {
    const existingStyle = document.createElement('style')
    existingStyle.id = 'markee-revealjs-styles'

    vi.spyOn(document, 'getElementById')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(existingStyle)

    const append = vi.spyOn(document.head, 'append')
    const { loadRevealStyles } = await import('./styles.js')

    await loadRevealStyles()

    expect(append).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#markee-revealjs-styles')).toHaveLength(0)
  })
})
