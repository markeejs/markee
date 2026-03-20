import { describe, expect, it, vi } from 'vitest'

async function importRuntime({
  mermaidModule,
  dbmlRenderer,
  d3Selection,
}: {
  mermaidModule?: any
  dbmlRenderer?: any
  d3Selection?: any
} = {}) {
  vi.resetModules()

  vi.doMock('mermaid', () => ({
    default: mermaidModule ?? {
      initialize: vi.fn(),
    },
  }))
  vi.doMock(
    '@softwaretechnik/dbml-renderer',
    () =>
      dbmlRenderer ?? {
        run: vi.fn(),
      },
  )
  vi.doMock(
    'd3-selection',
    () =>
      d3Selection ?? {
        select: vi.fn(),
        default: { select: vi.fn() },
      },
  )
  vi.doMock('d3-graphviz', () => ({}))

  return await import('./runtime.js')
}

describe('@markee/diagrams runtime', () => {
  it('loads mermaid once and initializes it', async () => {
    const initialize = vi.fn()
    const { loadMermaid } = await importRuntime({
      mermaidModule: { initialize },
    })

    const first = await loadMermaid()
    const second = await loadMermaid()

    expect(first).toBe(second)
    expect(initialize).toHaveBeenCalledWith({ startOnLoad: false })
  })

  it('loads and caches the dbml runtime helpers', async () => {
    const run = vi.fn()
    const select = vi.fn()
    const { loadDiagramRuntime } = await importRuntime({
      dbmlRenderer: { run },
      d3Selection: { select, default: { select } },
    })

    const first = await loadDiagramRuntime()
    const second = await loadDiagramRuntime()

    expect(first).toBe(second)
    expect(first.dbmlRun).toBe(run)
    expect(first.select).toBe(select)
  })

  it('throws when d3-selection does not expose a select function', async () => {
    const { loadDiagramRuntime } = await importRuntime({
      d3Selection: { select: undefined, default: {} },
    })

    await expect(loadDiagramRuntime()).rejects.toThrow(
      'Could not load d3-selection runtime.',
    )
  })
})
