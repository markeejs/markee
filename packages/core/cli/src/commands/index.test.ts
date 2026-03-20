import { describe, expect, it } from 'vitest'

import { build, dev, init, serve } from './index.js'
import { commandBuild } from './build.js'
import { commandDev } from './dev.js'
import { commandInit } from './init.js'
import { commandServe } from './serve.js'

describe('commands/index', () => {
  it('re-exports the command entrypoints', () => {
    expect(build).toBe(commandBuild)
    expect(dev).toBe(commandDev)
    expect(init).toBe(commandInit)
    expect(serve).toBe(commandServe)
  })
})
