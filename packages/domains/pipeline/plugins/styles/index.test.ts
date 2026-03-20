import { describe, expect, it, vi } from 'vitest'

describe('styles/index', () => {
  it('loads the package stylesheet entrypoint without throwing', async () => {
    vi.resetModules()

    await expect(import('./index.js')).resolves.toBeDefined()
  })
})
