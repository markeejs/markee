import { beforeEach, describe, expect, it, vi } from 'vitest'

const anchorsState = vi.hoisted(() => ({
  callback: undefined as undefined | (() => void),
  observe: vi.fn(),
  navigation: {
    files: {
      '/docs/v3/guide.md': { link: '/docs/latest/guide' },
      '/docs/v3': { link: '/docs/latest' },
    },
    folders: {
      '/docs': {
        version: { folder: true },
        versions: [{ key: '/docs/v3' }, { key: '/docs/v2' }],
      },
      '/latest': {
        version: { folder: false },
        versions: [{ key: '/docs/v3' }],
      },
    },
  },
}))

vi.mock('@markee/state', () => ({
  state: {
    $navigation: {
      get: () => anchorsState.navigation,
    },
  },
}))

class FakeMutationObserver {
  constructor(callback: () => void) {
    anchorsState.callback = callback
  }

  observe(...args: any[]) {
    anchorsState.observe(...args)
  }
}

describe('anchors listener', () => {
  beforeEach(() => {
    vi.resetModules()
    anchorsState.observe.mockClear()
    anchorsState.callback = undefined
    ;(globalThis as any).MutationObserver = FakeMutationObserver
    document.body.innerHTML = ''
  })

  it('rewrites markdown links, resolves latest-version links, and marks them with data-file', async () => {
    await import('./anchors.js')

    document.body.innerHTML = `
      <a id="versioned" href="${window.location.origin}/docs/v2/guide.md" version="latest"></a>
      <a id="root-version" href="${window.location.origin}/latest/anything.md" version="latest"></a>
    `

    anchorsState.callback?.()

    expect(
      document.getElementById('versioned')?.getAttribute('data-file'),
    ).toBe('/docs/v3/guide.md')
    expect(document.getElementById('versioned')?.getAttribute('href')).toBe(
      '/docs/latest/guide',
    )

    expect(document.getElementById('root-version')?.getAttribute('data-file')).toBe(
      '/docs/v3',
    )
    expect(document.getElementById('root-version')?.getAttribute('href')).toBe(
      '/docs/latest',
    )
  })

  it('ignores foreign links and logs broken local links', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await import('./anchors.js')

    document.body.innerHTML = `
      <a id="foreign" href="https://example.test/docs/file.md"></a>
      <a id="broken" href="${window.location.origin}/missing.md"></a>
      <a id="latest-broken" href="${window.location.origin}/unknown/latest.md" version="latest"></a>
    `

    anchorsState.callback?.()

    expect(document.getElementById('foreign')?.getAttribute('href')).toBe(
      'https://example.test/docs/file.md',
    )
    expect(error).toHaveBeenCalledWith('Found broken link:', '/missing.md')
    expect(error).toHaveBeenCalledWith('Found broken link:', '/unknown/latest.md')
    expect(document.getElementById('broken')?.getAttribute('href')).toBe('/')
  })
})
