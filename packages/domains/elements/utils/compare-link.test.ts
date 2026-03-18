import { describe, expect, it } from 'vitest'

import { compareLink } from './compare-link'

describe('compareLink', () => {
  it('returns false when either input is missing', () => {
    expect(compareLink('', 'docs/page')).toBe(false)
    expect(compareLink('docs/page', '')).toBe(false)
  })

  it('normalizes leading and trailing slashes before comparing', () => {
    expect(compareLink('/docs/page/', '/docs/page')).toBe(true)
    expect(compareLink('/docs/page', '/docs/page/')).toBe(true)
    expect(compareLink('docs/page', '/docs/page')).toBe(true)
  })

  it('decodes the path before comparing', () => {
    expect(compareLink('docs/hello world', 'docs/hello%20world')).toBe(true)
    expect(compareLink('docs/hello world', 'docs/hello%2Fworld')).toBe(false)
  })
})
