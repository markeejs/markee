import { describe, expect, it, vi } from 'vitest'

const entrypointState = vi.hoisted(() => ({
  runtime: { runtime: true },
  state: { state: true },
}))

vi.mock('@markee/runtime', () => entrypointState.runtime)
vi.mock('@markee/state', () => entrypointState.state)

describe('entrypoints', () => {
  it('re-exports runtime from the extend entrypoint', async () => {
    vi.resetModules()
    await expect(import('./extend.js')).resolves.toMatchObject(entrypointState.runtime)
  })

  it('re-exports state from the state entrypoint', async () => {
    vi.resetModules()
    await expect(import('./state.js')).resolves.toMatchObject(entrypointState.state)
  })
})
