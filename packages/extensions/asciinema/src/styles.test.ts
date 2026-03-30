import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('asciinema-player/dist/bundle/asciinema-player.css?raw', () => ({
  default: '.asciinema-player{}',
}))
vi.mock('./index.css?raw', () => ({
  default: 'asciinema-player{display:block}',
}))

describe('@markee/asciinema styles', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('injects the asciinema player and local styles once', async () => {
    const { loadAsciinemaStyles } = await import('./styles.js')

    await loadAsciinemaStyles()
    await loadAsciinemaStyles()

    const style = document.getElementById(
      'markee-asciinema-styles',
    ) as HTMLStyleElement
    expect(style).not.toBeNull()
    expect(style.innerHTML).toContain('.asciinema-player{}')
    expect(style.innerHTML).toContain('asciinema-player{display:block}')
    expect(document.querySelectorAll('#markee-asciinema-styles')).toHaveLength(
      1,
    )
  })

  it('skips injection when styles appear while imports are resolving', async () => {
    const existingStyle = document.createElement('style')
    existingStyle.id = 'markee-asciinema-styles'

    vi.spyOn(document, 'getElementById')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(existingStyle)

    const append = vi.spyOn(document.head, 'append')
    const { loadAsciinemaStyles } = await import('./styles.js')

    await loadAsciinemaStyles()

    expect(append).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#markee-asciinema-styles')).toHaveLength(
      0,
    )
  })
})
