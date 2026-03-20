import { describe, expect, it, vi } from 'vitest'

describe('index.js', () => {
  it('warns that the package must be externalized when imported directly', async () => {
    vi.resetModules()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await import('./index.js')

    expect(error).toHaveBeenCalledWith(
      'You need to set @markee/pipeline as external when bundling',
    )
  })
})
