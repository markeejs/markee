import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeIndexState = vi.hoisted(() => ({
  markdownPipeline: { name: 'markdown-pipeline' },
  prism: { loadLanguage: vi.fn() },
  state: { value: 'state' },
}))

vi.mock('@markee/pipeline/extensions.js', () => ({
  markdownPipeline: runtimeIndexState.markdownPipeline,
}))

vi.mock('@markee/pipeline/plugins/remark/prism.extensions.js', () => ({
  prism: runtimeIndexState.prism,
}))

vi.mock('@markee/state', () => ({
  state: runtimeIndexState.state,
}))

async function importRuntimeIndex() {
  vi.resetModules()
  return import('@markee/runtime')
}

describe('index', () => {
  beforeEach(() => {
    delete (window as unknown as Record<PropertyKey, unknown>)[
      Symbol.for('markee::development')
    ]
  })

  it('exposes the extension hooks and state re-export', async () => {
    const module = await importRuntimeIndex()

    expect(module.extend.search).toEqual({})
    expect(module.extend.navigation).toEqual({})
    expect(module.extend.markdownPipeline).toBe(runtimeIndexState.markdownPipeline)
    expect(module.extend.prism).toBe(runtimeIndexState.prism)
    expect(module.state).toBe(runtimeIndexState.state)
    expect(module.MarkeeElement).toBeDefined()
    expect(module.BooleanConverter('')).toBe(true)
  })

  it('computes development as false when the development symbol is absent', async () => {
    const module = await importRuntimeIndex()

    expect(module.development).toBe(false)
  })

  it('computes development as true when the development symbol is present', async () => {
    ;(window as unknown as Record<PropertyKey, unknown>)[
      Symbol.for('markee::development')
    ] = true

    const module = await importRuntimeIndex()

    expect(module.development).toBe(true)
  })
})
