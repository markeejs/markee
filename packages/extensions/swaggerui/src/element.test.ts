import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  SwaggerUIBundle,
  baseLayoutLoads,
  createFilterLayoutPlugin,
  loadSwaggerUiStyles,
} = vi.hoisted(() => ({
  SwaggerUIBundle: vi.fn(() => ({
    destroy: vi.fn(),
  })),
  baseLayoutLoads: { count: 0 },
  createFilterLayoutPlugin: vi.fn(() => 'filter-layout-plugin'),
  loadSwaggerUiStyles: vi.fn(async () => {}),
}))

vi.mock('swagger-ui-dist/swagger-ui-bundle.js', () => ({
  default: SwaggerUIBundle,
}))
vi.mock('./base-layout.js', () => {
  baseLayoutLoads.count += 1
  return {
    createFilterLayoutPlugin,
  }
})
vi.mock('./styles.js', () => ({
  loadSwaggerUiStyles,
}))

beforeAll(async () => {
  const { registerSwaggerUiElement } = await import('./element.js')
  registerSwaggerUiElement()
})

function waitForMount() {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve())
}

describe('swaggerui element', () => {
  beforeEach(() => {
    SwaggerUIBundle.mockClear()
    baseLayoutLoads.count = 0
    createFilterLayoutPlugin.mockClear()
    loadSwaggerUiStyles.mockClear()
    document.body.replaceChildren()
  })

  it('loads styles only when the first element mounts', async () => {
    expect(loadSwaggerUiStyles).not.toHaveBeenCalled()
    expect(baseLayoutLoads.count).toBe(0)

    const first = document.createElement('markee-swaggerui')
    first.dataset.source = btoa('{"openapi":"3.1.0","info":{"title":"Demo"}}')

    document.body.append(first)
    await waitForMount()

    expect(loadSwaggerUiStyles).toHaveBeenCalledTimes(1)
    expect(baseLayoutLoads.count).toBe(0)

    const second = document.createElement('markee-swaggerui')
    second.dataset.source = btoa('{"openapi":"3.1.0","info":{"title":"Demo"}}')

    document.body.append(second)
    await waitForMount()

    expect(loadSwaggerUiStyles).toHaveBeenCalledTimes(1)
    expect(baseLayoutLoads.count).toBe(0)
  })

  it('loads the filter layout only when a filter is active', async () => {
    const spec = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Demo' },
      paths: {
        '/pets': {
          get: {
            tags: ['Users'],
          },
        },
      },
    })
    const filters = JSON.stringify({
      tag: 'users',
      operation: '',
      schema: '',
    })

    const first = document.createElement('markee-swaggerui')
    first.dataset.source = btoa(spec)
    first.dataset.filters = btoa(filters)

    document.body.append(first)
    await waitForMount()

    expect(baseLayoutLoads.count).toBe(1)

    const second = document.createElement('markee-swaggerui')
    second.dataset.source = btoa(spec)
    second.dataset.filters = btoa(filters)

    document.body.append(second)
    await waitForMount()

    expect(baseLayoutLoads.count).toBe(1)
  })
})
