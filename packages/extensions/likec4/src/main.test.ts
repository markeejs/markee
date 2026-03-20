import { describe, expect, it, vi } from 'vitest'

async function importMain() {
  vi.resetModules()

  const registerLikeC4Element = vi.fn()
  const registerLikeC4Remark = vi.fn()

  vi.doMock('./element.js', () => ({
    registerLikeC4Element,
  }))
  vi.doMock('./remark.js', () => ({
    registerLikeC4Remark,
  }))

  await import('./main.js')

  return { registerLikeC4Element, registerLikeC4Remark }
}

describe('@markee/likec4 main', () => {
  it('registers the LikeC4 element and remark plugin on import', async () => {
    const { registerLikeC4Element, registerLikeC4Remark } = await importMain()

    expect(registerLikeC4Element).toHaveBeenCalledTimes(1)
    expect(registerLikeC4Remark).toHaveBeenCalledTimes(1)
  })
})
