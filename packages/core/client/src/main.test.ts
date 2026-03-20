import { describe, expect, it, vi } from 'vitest'

const mainState = vi.hoisted(() => ({
  stateImported: false,
  rootImported: false,
}))

vi.mock('@markee/state', () => {
  mainState.stateImported = true
  return {}
})

vi.mock('./elements/root.js', () => {
  mainState.rootImported = true
  return {}
})

describe('main', () => {
  it('loads state and the root element entrypoint', async () => {
    vi.resetModules()
    mainState.stateImported = false
    mainState.rootImported = false

    await import('./main.js')

    expect(mainState.stateImported).toBe(true)
    expect(mainState.rootImported).toBe(true)
  })
})
