import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import { MarkeeArticle } from './markee-article'

const runtimeState = {
  navigation: { files: {} },
}

beforeEach(() => {
  runtimeState.navigation = { files: {} }
  vi.restoreAllMocks()
  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => runtimeState.navigation as any,
  )
  vi.spyOn(state.$navigation, 'subscribe').mockImplementation(() => () => {})
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

    const element = new MarkeeArticle()
    element.article = 'docs/guide.md'
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/docs/guide')
    expect(element.textContent).toBe('Guide')
  })

  it('renders an empty anchor when the article is missing', async () => {
    const element = new MarkeeArticle()
    element.article = 'missing.md'
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')).not.toBeNull()
    expect(element.querySelector('a')?.getAttribute('href')).toBe('')
    expect(element.textContent).toBe('')
  })

  it('falls back to an empty lookup key when article is unset', async () => {
    const element = new MarkeeArticle() as any
    element.article = undefined
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('a')?.getAttribute('href')).toBe('')
    expect(element.textContent).toBe('')
  })
})
