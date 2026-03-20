import { describe, expect, it, vi } from 'vitest'

vi.mock('../cache.js', () => ({
  cache: vi.fn(),
}))

import { $navigationLoader } from './metadata.js'
import {
  $router,
  compareLink,
  handleRouterNavigationClick,
  installRouterNavigationListener,
} from './router.js'

function setNavigation() {
  $navigationLoader.set({
    loading: false,
    data: {
      files: {
        'guide.md': {
          link: '/docs/guide',
          alias: ['/guide-alias'],
          layout: 'docs',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          payload: {},
        } as any,
      },
      folders: {},
      assets: {},
    },
    error: null,
  })
}

function createClickEvent(
  link: Element,
  init: Partial<MouseEventInit> = {},
) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  })
  Object.defineProperty(event, 'target', {
    configurable: true,
    value: link,
  })
  return event
}

describe('compareLink', () => {
  it('normalizes leading and trailing slashes before comparing', () => {
    expect(compareLink('/docs/guide/', 'docs/guide')).toBe(true)
    expect(compareLink('docs/guide', '/docs/guide/')).toBe(true)
  })

  it('decodes encoded paths before comparing', () => {
    expect(compareLink('/docs/hello world', '/docs/hello%20world')).toBe(true)
  })

  it('returns false for empty values and mismatched paths', () => {
    expect(compareLink('', '/docs')).toBe(false)
    expect(compareLink('/docs', '')).toBe(false)
    expect(compareLink('/docs/a', '/docs/b')).toBe(false)
  })
})

describe('$router', () => {
  it('updates the router path when opened', () => {
    $router.open('/docs/guide')

    expect($router.get()?.path).toBe('/docs/guide')
  })

  it('installs the document click listener', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener')

    installRouterNavigationListener()

    expect(addEventListener).toHaveBeenCalledWith(
      'click',
      handleRouterNavigationClick,
    )
  })

  it('navigates matching internal links by data-file or alias', () => {
    setNavigation()
    const open = vi.spyOn($router, 'open')
    history.replaceState({}, '', '/docs/start')
    const base = window.location.origin

    const direct = document.createElement('a')
    direct.href = `${base}/docs/guide`
    direct.dataset.file = 'guide.md'
    const directEvent = createClickEvent(direct)
    handleRouterNavigationClick(directEvent)

    const alias = document.createElement('a')
    alias.href = `${base}/guide-alias`
    const aliasEvent = createClickEvent(alias)
    handleRouterNavigationClick(aliasEvent)

    expect(open).toHaveBeenNthCalledWith(1, direct.href)
    expect(open).toHaveBeenNthCalledWith(2, alias.href)
  })

  it('prevents default on same-page links and scrolls matching hashes into view', () => {
    setNavigation()
    const querySelector = vi
      .spyOn(document, 'querySelector')
      .mockReturnValue({ scrollIntoView: vi.fn() } as any)
    history.replaceState({}, '', '/docs/guide#intro')
    const base = window.location.origin

    const link = document.createElement('a')
    link.href = `${base}/docs/guide#intro`

    const event = createClickEvent(link)
    handleRouterNavigationClick(event)

    expect(event.defaultPrevented).toBe(true)
    expect(querySelector).toHaveBeenCalledWith('#intro')
  })

  it('ignores disallowed clicks and unmatched links', () => {
    setNavigation()
    const open = vi.spyOn($router, 'open')
    history.replaceState({}, '', '/docs/guide')
    const base = window.location.origin

    const cases = [
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        return createClickEvent(link, { button: 1 })
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        link.rel = 'external'
        return createClickEvent(link)
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        link.target = '_blank'
        return createClickEvent(link)
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        link.target = '_self'
        return createClickEvent(link)
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = 'https://other.example.com/docs/guide'
        return createClickEvent(link)
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        link.download = 'guide'
        return createClickEvent(link)
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        return createClickEvent(link, { altKey: true })
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        return createClickEvent(link, { metaKey: true })
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        return createClickEvent(link, { ctrlKey: true })
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/docs/guide`
        return createClickEvent(link, { shiftKey: true })
      })(),
      (() => {
        const link = document.createElement('a')
        link.href = `${base}/missing`
        return createClickEvent(link)
      })(),
    ]

    for (const event of cases) {
      handleRouterNavigationClick(event)
    }

    const preventedLink = document.createElement('a')
    preventedLink.href = `${base}/docs/guide`
    const preventedEvent = createClickEvent(preventedLink)
    preventedEvent.preventDefault()
    handleRouterNavigationClick(preventedEvent)

    const target = document.createElement('span')
    handleRouterNavigationClick(createClickEvent(target))

    expect(open).not.toHaveBeenCalled()
  })
})
