import { describe, expect, it } from 'vitest'

import { ModuleHelpers } from './module.js'

describe('ModuleHelpers', () => {
  it('resolves installed package entrypoints', () => {
    expect(ModuleHelpers.resolve('@markee/client')).toContain(
      '/packages/core/client/',
    )
  })
})
