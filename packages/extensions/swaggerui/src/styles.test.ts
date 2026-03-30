import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('swagger-ui-dist/swagger-ui.css?raw', () => ({
  default: '.swagger-ui{}',
}))
vi.mock('./index.css?raw', () => ({
  default: 'markee-swaggerui{display:block}',
}))

describe('swaggerui styles', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('injects the Swagger UI and local styles once', async () => {
    const { loadSwaggerUiStyles } = await import('./styles.js')

    await loadSwaggerUiStyles()
    await loadSwaggerUiStyles()

    const style = document.getElementById(
      'markee-swaggerui-styles',
    ) as HTMLStyleElement
    expect(style).not.toBeNull()
    expect(style.innerHTML).toContain('.swagger-ui{}')
    expect(style.innerHTML).toContain('markee-swaggerui{display:block}')
    expect(document.querySelectorAll('#markee-swaggerui-styles')).toHaveLength(
      1,
    )
  })

  it('skips injection when styles appear while imports are resolving', async () => {
    const existingStyle = document.createElement('style')
    existingStyle.id = 'markee-swaggerui-styles'

    vi.spyOn(document, 'getElementById')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(existingStyle)

    const append = vi.spyOn(document.head, 'append')
    const { loadSwaggerUiStyles } = await import('./styles.js')

    await loadSwaggerUiStyles()

    expect(append).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#markee-swaggerui-styles')).toHaveLength(
      0,
    )
  })
})
