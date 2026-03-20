import { beforeEach, describe, expect, it, vi } from 'vitest'

const metadataState = vi.hoisted(() => ({
  configCallback: undefined as undefined | ((value: any) => void),
  currentFileCallback: undefined as undefined | ((value: any) => void),
  currentLoaderCallback: undefined as undefined | ((value: any) => void),
  colorSchemeCallback: undefined as undefined | ((value: any) => void),
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
    vi.spyOn(window, 'matchMedia').mockReturnValue({
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
    } as MediaQueryList)

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
    expect(document.body.dataset.colorScheme).toBe('auto')
    expect(metadataState.loadTheme).toHaveBeenCalledWith('oneDark')

    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    } as MediaQueryList)
    metadataState.colorSchemeCallback?.('auto')
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
})
