import { describe, expect, it } from 'vitest'

import { SimpleTokenizer } from './index.js'

describe('SimpleTokenizer', () => {
  it('tokenizes front matter and custom directives', () => {
    const tokens = SimpleTokenizer.tokenizeMarkdown(
      [
        '---',
        'title: Example',
        '---',
        '',
        '::badge[Leaf]{tone=positive}',
        '',
        ':::note[Label]',
        'Body',
        ':::',
      ].join('\n'),
    )

    expect(tokens.some((token) => token.type === 'front_matter')).toBe(true)
    expect(
      tokens.some(
        (token) =>
          token.type === 'directive_leaf' && token.meta?.name === 'badge',
      ),
    ).toBe(true)
    expect(
      tokens.some(
        (token) =>
          token.type === 'directive_container_open' &&
          token.meta?.name === 'note',
      ),
    ).toBe(true)
  })
})
