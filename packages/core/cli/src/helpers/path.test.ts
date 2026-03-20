import { describe, expect, it } from 'vitest'

import { PathHelpers, sanitize } from './path.js'

describe('PathHelpers', () => {
  it('concatenates paths without letting absolute parts reset the root', () => {
    expect(PathHelpers.concat('/root', '/docs', 'guide.md')).toBe(
      '/root/docs/guide.md',
    )
  })

  it('sanitizes windows-style url pathnames', () => {
    expect(sanitize('/C:/Users/test/project')).toBe('/Users/test/project')
    expect(sanitize('/Users/test/project')).toBe('/Users/test/project')
  })
})
