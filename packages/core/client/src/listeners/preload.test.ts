import { beforeEach, describe, expect, it, vi } from 'vitest'

const preloadState = vi.hoisted(() => ({
  navigation: {
    files: {
      '/guide/intro.md': {
        link: '/docs/intro',
        alias: ['/docs/start'],
      },
    },
  },
  preload: vi.fn(),
  root: vi.fn(() => '/docs'),
  compareLink: vi.fn((a: string, b: string) => a === b),
}))

vi.mock('@markee/state', () => ({
  state: {
    $navigation: {
      get: () => preloadState.navigation,
    },
  },
}))

vi.mock('@markee/elements/utils/compare-link.js', () => ({
  compareLink: preloadState.compareLink,
}))

vi.mock('@markee/state/store/current.js', () => ({
  preload: preloadState.preload,
  root: preloadState.root,
}))

describe('preload listener', () => {
  beforeEach(() => {
    vi.resetModules()
    preloadState.preload.mockClear()
    preloadState.root.mockClear()
    preloadState.compareLink.mockClear()
    document.body.innerHTML = ''
  })

  it('preloads files directly from the data-file attribute', async () => {
    await import('./preload.js')

    document.body.innerHTML = `<a id="direct" data-file="/guide/intro.md" href="${window.location.origin}/docs/intro">Intro</a>`
    const link = document.getElementById('direct')!

    link.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))

    expect(preloadState.root).toHaveBeenCalledWith(
      preloadState.navigation.files['/guide/intro.md'],
    )
    expect(preloadState.preload).toHaveBeenCalledWith(
      '/docs/guide/intro.md',
      '/guide/intro.md',
    )
  })

  it('falls back to matching links and aliases when data-file is missing', async () => {
    await import('./preload.js')
    preloadState.compareLink.mockImplementation(((a: string, b: string) =>
      a === b ? true : undefined) as any)

    document.body.innerHTML = `<a id="alias" href="${window.location.origin}/docs/start">Start</a>`
    document
      .getElementById('alias')!
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))

    expect(preloadState.compareLink).toHaveBeenCalled()
    expect(preloadState.preload).toHaveBeenCalledWith(
      '/docs/guide/intro.md',
      '/guide/intro.md',
    )
  })
})
