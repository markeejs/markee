import { beforeEach, describe, expect, it, vi } from 'vitest'

const metadataState = vi.hoisted(() => ({
  configCallback: undefined as undefined | ((value: any) => void),
  currentFileCallback: undefined as undefined | ((value: any) => void),
  currentLoaderCallback: undefined as undefined | ((value: any) => void),
  colorSchemeCallback: undefined as undefined | ((value: any) => void),
  colorSchemeGet: vi.fn(() => 'auto'),
  combineCallback: undefined as undefined | ((value: [any, any]) => void),
  loadTheme: vi.fn(),
  prism: {
    lightTheme: 'oneLight' as string | undefined,
    darkTheme: 'oneDark' as string | undefined,
  },
}))

vi.mock('@markee/runtime', () => ({
  state: {
    $config: {
      subscribe(callback: (value: any) => void) {
        metadataState.configCallback = callback
        return () => {}
      },
    },
    $currentFile: {
      subscribe(callback: (value: any) => void) {
        metadataState.currentFileCallback = callback
        return () => {}
      },
    },
    $currentLoader: {
      subscribe(callback: (value: any) => void) {
        metadataState.currentLoaderCallback = callback
        return () => {}
      },
    },
    $colorScheme: {
      get: metadataState.colorSchemeGet,
      subscribe(callback: (value: any) => void) {
        metadataState.colorSchemeCallback = callback
        return () => {}
      },
    },
    combine() {
      return {
        subscribe(callback: (value: [any, any]) => void) {
          metadataState.combineCallback = callback
          return () => {}
        },
      }
    },
  },
  extend: {
    prism: {
      get lightTheme() {
        return metadataState.prism.lightTheme
      },
      get darkTheme() {
        return metadataState.prism.darkTheme
      },
      loadTheme: metadataState.loadTheme,
    },
  },
}))

describe('metadata listener', () => {
  beforeEach(() => {
    vi.resetModules()
    metadataState.loadTheme.mockClear()
    metadataState.colorSchemeGet.mockReset().mockReturnValue('auto')
    metadataState.prism.lightTheme = 'oneLight'
    metadataState.prism.darkTheme = 'oneDark'
    document.body.removeAttribute('class')
    document.body.dataset.theme = ''
    document.body.dataset.path = ''
    document.body.dataset.layout = ''
    document.body.dataset.loading = ''
    document.body.dataset.colorScheme = ''
    document.title = 'Site'
  })

  it('syncs config, current file, loader, color scheme, and title metadata onto the document', async () => {
    await import('./metadata.js')

    metadataState.configCallback?.({ theme: 'docs' })
    expect(document.body.dataset.theme).toBe('docs')

    metadataState.currentFileCallback?.({ link: '/docs/intro' })
    expect(document.body.dataset.path).toBe('/docs/intro')

    metadataState.currentLoaderCallback?.({
      loading: false,
      data: { layout: 'article', className: 'page-docs' },
    })
    expect(document.body.dataset.loading).toBe('false')
    expect(document.body.dataset.layout).toBe('article')
    expect(document.body.getAttribute('class')).toBe('page-docs')

    metadataState.colorSchemeCallback?.('light')
    expect(document.body.dataset.colorScheme).toBe('light')
    expect(metadataState.loadTheme).toHaveBeenCalledWith('oneLight')

    metadataState.combineCallback?.([
      { titleTemplate: '{site}{if:page: - }{page}' },
      { frontMatter: { title: 'Intro ' } },
    ])
    expect(document.title).toBe('Site - Intro')

    metadataState.combineCallback?.([{}, { frontMatter: { title: 'Intro' } }])
    expect(document.title).toBe('Site - Intro')
  })

  it('handles loading state, auto color scheme, missing classes, and missing page titles', async () => {
    const mediaQuery = {
      matches: true,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    }
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery as MediaQueryList)

    await import('./metadata.js')

    metadataState.currentLoaderCallback?.({ loading: true, data: null })
    expect(document.body.dataset.loading).toBe('true')

    document.body.setAttribute('class', 'stale')
    metadataState.currentLoaderCallback?.({
      loading: false,
      data: { layout: 'plain' },
    })
    expect(document.body.getAttribute('class')).toBeNull()

    metadataState.colorSchemeCallback?.('auto')
    expect(document.body.dataset.colorScheme).toBe('dark')
    expect(metadataState.loadTheme).toHaveBeenCalledWith('oneDark')

    mediaQuery.matches = false
    metadataState.colorSchemeCallback?.('auto')
    expect(document.body.dataset.colorScheme).toBe('light')
    expect(metadataState.loadTheme).toHaveBeenLastCalledWith('oneLight')

    metadataState.prism.lightTheme = undefined
    metadataState.prism.darkTheme = undefined
    metadataState.colorSchemeCallback?.('light')
    metadataState.colorSchemeCallback?.('dark')
    expect(metadataState.loadTheme).toHaveBeenNthCalledWith(3, 'oneLight')
    expect(metadataState.loadTheme).toHaveBeenNthCalledWith(4, 'oneDark')

    metadataState.combineCallback?.([
      { titleTemplate: '{site}{if:page: - }{page}' },
      { frontMatter: {} },
    ])
    expect(document.title).toBe('Site')

    metadataState.configCallback?.(null)
    expect(document.body.dataset.theme).toBe('default')
  })

  it('updates auto color scheme when the system preference changes and respects explicit preferences', async () => {
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
    }
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue(mediaQuery as unknown as MediaQueryList)

    await import('./metadata.js')

    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    expect(mediaQuery.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
    const onChange = mediaQuery.addEventListener.mock.calls[0][1]

    mediaQuery.matches = true
    onChange()
    expect(document.body.dataset.colorScheme).toBe('dark')
    expect(metadataState.loadTheme).toHaveBeenLastCalledWith('oneDark')

    mediaQuery.matches = false
    onChange()
    expect(document.body.dataset.colorScheme).toBe('light')
    expect(metadataState.loadTheme).toHaveBeenLastCalledWith('oneLight')

    metadataState.colorSchemeGet.mockReturnValue('light')
    mediaQuery.matches = true
    onChange()
    expect(document.body.dataset.colorScheme).toBe('light')
    expect(metadataState.loadTheme).toHaveBeenLastCalledWith('oneLight')

    metadataState.colorSchemeGet.mockReturnValue('dark')
    mediaQuery.matches = false
    onChange()
    expect(document.body.dataset.colorScheme).toBe('dark')
    expect(metadataState.loadTheme).toHaveBeenLastCalledWith('oneDark')
  })
})
