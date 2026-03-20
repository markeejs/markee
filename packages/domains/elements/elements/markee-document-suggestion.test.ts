import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import { MarkeeDocumentSuggestion } from './markee-document-suggestion'

const runtimeState = {
  router: {
    path: '/' as string | undefined,
    navigate: {
      open: vi.fn(),
      replace: vi.fn(),
    },
  } as ReturnType<typeof state.$router.get>,
  navigation: {
    files: {} as Record<string, any>,
    folders: {} as Record<string, any>,
  },
}

beforeEach(() => {
  runtimeState.router = {
    path: '/',
    navigate: {
      open: vi.fn(),
      replace: vi.fn(),
    },
  }
  runtimeState.navigation = { files: {}, folders: {} }

  vi.restoreAllMocks()
  vi.spyOn(state.$router, 'get').mockImplementation(() => runtimeState.router)
  vi.spyOn(state.$router, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => runtimeState.navigation as any,
  )
  vi.spyOn(state.$navigation, 'subscribe').mockImplementation(() => () => {})
})

describe('markee-document-suggestion', () => {
  it('renders the most similar documents using the default limit', async () => {
    runtimeState.router.path = '/guides/alpha'
    runtimeState.navigation = {
      files: {
        'guides/alpha.md': {
          link: '/guides/alpha',
          frontMatter: { title: 'Alpha' },
        },
        'guides/alpha-advanced.md': {
          link: '/guides/alpha-advanced',
          frontMatter: { title: 'Alpha Advanced' },
        },
        'guides/alpha-patterns.md': {
          link: '/guides/alpha-patterns',
          frontMatter: { title: 'Alpha Patterns' },
        },
        'guides/alpha-api.md': {
          link: '/guides/alpha-api',
          frontMatter: { title: 'Alpha API' },
        },
        'guides/alpha-tools.md': {
          link: '/guides/alpha-tools',
          frontMatter: { title: 'Alpha Tools' },
        },
        'reference/http.md': {
          link: '/reference/http',
          frontMatter: { title: 'HTTP' },
        },
      },
      folders: {},
    }

    const element = new MarkeeDocumentSuggestion()
    document.body.append(element)

    await element.updateComplete

    const items = [...element.querySelectorAll('li')]
    const links = items.map((item) => item.querySelector('pre')?.textContent)

    expect(items).toHaveLength(5)
    expect(links[0]).toBe('/guides/alpha')
    expect(links).not.toContain('/reference/http')
    expect(links.slice().sort()).toEqual([
      '/guides/alpha',
      '/guides/alpha-advanced',
      '/guides/alpha-api',
      '/guides/alpha-patterns',
      '/guides/alpha-tools',
    ])
    expect(items[0]?.querySelector('a')?.getAttribute('href')).toBe(
      '/guides/alpha',
    )
    expect(items[0]?.querySelector('span')?.textContent).toBe('Alpha')
  })

  it('uses the configured limit and resolves breadcrumb titles through all fallback levels', async () => {
    runtimeState.router.path = undefined
    runtimeState.navigation = {
      files: {
        'guides/reference/inferred/untitled/page.md': {
          link: '/guides/reference/inferred/untitled/page',
          frontMatter: {},
        },
        'reference/http.md': {
          link: '/reference/http',
          frontMatter: { title: 'HTTP' },
        },
      },
      folders: {
        'guides': {
          title: 'Guides',
          navigation: [{ key: 'guides/reference', title: 'Reference' }],
        },
        'guides/reference': {},
        'guides/reference/inferred': {
          inferredTitle: 'Inferred',
        },
        'guides/reference/inferred/untitled': {},
      },
    }

    const element = new MarkeeDocumentSuggestion()
    element.limit = 1
    document.body.append(element)

    await element.updateComplete

    const item = element.querySelector('li')
    const breadcrumbLabels = [
      ...element.querySelectorAll(
        '[data-breadcrumbs] > span:not([data-separator])',
      ),
    ].map((span) => span.textContent)
    const separators = element.querySelectorAll('[data-separator]')

    expect(element.querySelectorAll('li')).toHaveLength(1)
    expect(item?.querySelector('pre')?.textContent).toBe(
      '/guides/reference/inferred/untitled/page',
    )
    expect(item?.querySelector('a span')?.textContent).toBe('')
    expect(breadcrumbLabels).toEqual(['Guides', 'Reference', 'Inferred', ''])
    expect(separators).toHaveLength(3)
  })
})
