import { describe, expect, it } from 'vitest'

import { parseAttributes } from './attrs'

describe('parseAttributes', () => {
  it('parses attributes and normalizes class into className', () => {
    expect(
      parseAttributes('id="hero" hidden class="alpha beta alpha" count=2'),
    ).toEqual({
      id: 'hero',
      hidden: 'hidden',
      count: 2,
      className: ['alpha', 'beta'],
    })
  })

  it('merges into an existing destination and keeps unique class names', () => {
    const destination = {
      title: 'hello',
      className: ['beta', 'gamma'],
    }

    expect(
      parseAttributes('class="alpha beta" data-tags=[one,two]', destination),
    ).toEqual({
      'title': 'hello',
      'data-tags': ['one', 'two'],
      'className': ['beta', 'gamma', 'alpha'],
    })
  })
})
