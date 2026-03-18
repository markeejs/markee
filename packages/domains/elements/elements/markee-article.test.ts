import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeState = ((globalThis as any).__markeeArticleRuntimeState ??= {
  navigation: { files: {} },
})

vi.mock('@markee/runtime', async () => {
  const { LitElement } = await import('lit')

  class TestMarkeeElement extends LitElement {
    static with(_options: { role?: string }) {
      return this
    }

    createRenderRoot() {
      return this
    }
  }

  return {
    MarkeeElement: TestMarkeeElement,
    state: {
      $navigation: {
        get: () => runtimeState.navigation,
      },
    },
  }
})

await import('./markee-article')

beforeEach(() => {
  runtimeState.navigation = { files: {} }
})

describe('markee-article', () => {
  it('renders the linked article title', async () => {
    runtimeState.navigation = {
      files: {
        'docs/guide.md': {
          link: '/docs/guide',
          frontMatter: { title: 'Guide' },
        },
      },
    }

    const element = document.createElement('markee-article')
    element.setAttribute('data-article', 'docs/guide.md')
    document.body.append(element)

    await (element as any).updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/docs/guide')
    expect(element.textContent).toBe('Guide')
  })

  it('renders an empty anchor when the article is missing', async () => {
    const element = document.createElement('markee-article')
    element.setAttribute('data-article', 'missing.md')
    document.body.append(element)

    await (element as any).updateComplete

    expect(element.querySelector('a')).not.toBeNull()
    expect(element.querySelector('a')?.getAttribute('href')).toBe('')
    expect(element.textContent).toBe('')
  })

  it('falls back to an empty lookup key when article is unset', async () => {
    const element = document.createElement('markee-article') as any
    element.article = undefined
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('')
    expect(element.textContent).toBe('')
  })
})
