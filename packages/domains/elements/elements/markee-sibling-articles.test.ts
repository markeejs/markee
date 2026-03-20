import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $siblings } from '../utils/siblings'
import {
  MarkeeNextArticle,
  MarkeePreviousArticle,
} from './markee-sibling-articles'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn($siblings, 'get').mockReturnValue({
    previous: { key: 'docs/previous.md', file: { title: 'Previous' } },
    next: { key: 'docs/next.md', file: { title: 'Next' } },
  } as any)
  vi.spyOn($siblings, 'subscribe').mockImplementation(() => () => {})
})

describe('markee-sibling-articles', () => {
  it('renders the next article with the default article element', async () => {
    const element = new MarkeeNextArticle()
    document.body.append(element)

    await element.updateComplete

    expect(
      element.querySelector('markee-article')?.getAttribute('data-article'),
    ).toBe('docs/next.md')
  })

  it('renders the previous article with a custom article element', async () => {
    const element = new MarkeePreviousArticle()
    element.articleElement = 'test-article-card'
    document.body.append(element)

    await element.updateComplete

    expect(
      element.querySelector('test-article-card')?.getAttribute('data-article'),
    ).toBe('docs/previous.md')
  })

  it('falls back to an empty article key when a sibling is missing', async () => {
    vi.spyOn($siblings, 'get').mockReturnValue({
      previous: null,
      next: null,
    } as any)

    const next = new MarkeeNextArticle()
    const previous = new MarkeePreviousArticle()
    document.body.append(next, previous)

    await next.updateComplete
    await previous.updateComplete

    expect(
      next.querySelector('markee-article')?.getAttribute('data-article'),
    ).toBe('')
    expect(
      previous.querySelector('markee-article')?.getAttribute('data-article'),
    ).toBe('')
  })
})
