import { describe, expect, it, vi } from 'vitest'

import { encodeText } from './helpers.js'

const runtime = vi.hoisted(() => ({
  loadMermaid: vi.fn(),
  loadDiagramRuntime: vi.fn(),
}))

vi.mock('./runtime.js', () => ({
  loadMermaid: runtime.loadMermaid,
  loadDiagramRuntime: runtime.loadDiagramRuntime,
}))

let elementImport: Promise<void> | null = null

async function ensureElementImported() {
  elementImport ??= import('./element.js').then(
    ({ registerDiagramElement }) => {
      registerDiagramElement()
    },
  )
  await elementImport
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushAsyncWork(iterations = 6) {
  for (let index = 0; index < iterations; index++) {
    await Promise.resolve()
  }
}

function createDiagram(dataset: Record<string, string>) {
  const element = document.createElement('markee-diagram') as HTMLElement & {
    connectedCallback(): void
    disconnectedCallback(): void
  }
  Object.assign(element.dataset, dataset)
  return element
}

describe('@markee/diagrams element', () => {
  it('loads the custom element definition and handles basic input errors', async () => {
    runtime.loadMermaid.mockReset()
    runtime.loadDiagramRuntime.mockReset()
    await ensureElementImported()

    expect(
      window.customElements.get('markee-diagram') as CustomElementConstructor,
    ).toBeDefined()

    const unsupported = createDiagram({ source: encodeText('graph TD;A-->B') })
    document.body.append(unsupported)
    await flushAsyncWork()
    expect(unsupported.textContent).toContain('Unsupported diagram type.')

    const missingSource = createDiagram({ kind: 'mermaid' })
    document.body.append(missingSource)
    await flushAsyncWork()
    expect(missingSource.textContent).toContain('Missing diagram source.')

    const invalidSource = createDiagram({ kind: 'dbml', source: '%' })
    document.body.append(invalidSource)
    await flushAsyncWork()
    expect(invalidSource.textContent).toContain(
      'Could not decode diagram source.',
    )
  })

  it('renders mermaid diagrams with and without bind hooks', async () => {
    runtime.loadMermaid.mockReset()
    runtime.loadDiagramRuntime.mockReset()

    const bindFunctions = vi.fn()
    const firstRender = vi.fn().mockResolvedValue({
      svg: '<svg>first</svg>',
      bindFunctions,
    })
    const secondRender = vi.fn().mockResolvedValue({
      svg: '<svg>second</svg>',
    })

    runtime.loadMermaid
      .mockResolvedValueOnce({ render: firstRender })
      .mockResolvedValueOnce({ render: secondRender })

    await ensureElementImported()

    const first = createDiagram({
      kind: 'mermaid',
      source: encodeText('graph TD;A-->B'),
    })
    document.body.append(first)
    await flushAsyncWork()

    expect(first.innerHTML).toContain('<svg>first</svg>')
    expect(bindFunctions).toHaveBeenCalledWith(
      first.querySelector('.markee-diagram-mermaid'),
    )

    const second = createDiagram({
      kind: 'mermaid',
      source: encodeText('graph LR;A-->B'),
    })
    document.body.append(second)
    await flushAsyncWork()

    expect(second.innerHTML).toContain('<svg>second</svg>')
  })

  it('stops stale mermaid work before and after async rendering and reports failures', async () => {
    runtime.loadMermaid.mockReset()
    runtime.loadDiagramRuntime.mockReset()

    const beforeLoad = createDeferred<{ render: ReturnType<typeof vi.fn> }>()
    const renderBeforeLoad = vi.fn()
    const afterRender = createDeferred<{
      svg: string
      bindFunctions?: Function
    }>()
    const renderAfterLoad = vi.fn(() => afterRender.promise)
    const renderFailure = vi.fn().mockRejectedValue(new Error('boom'))

    runtime.loadMermaid
      .mockReturnValueOnce(beforeLoad.promise)
      .mockResolvedValueOnce({ render: renderAfterLoad })
      .mockResolvedValueOnce({ render: renderFailure })

    await ensureElementImported()

    const staleBeforeLoad = createDiagram({
      kind: 'mermaid',
      source: encodeText('graph TD;A-->B'),
    })
    document.body.append(staleBeforeLoad)
    staleBeforeLoad.disconnectedCallback()
    beforeLoad.resolve({ render: renderBeforeLoad })
    await flushAsyncWork()

    expect(renderBeforeLoad).not.toHaveBeenCalled()

    const staleAfterRender = createDiagram({
      kind: 'mermaid',
      source: encodeText('graph TD;B-->C'),
    })
    document.body.append(staleAfterRender)
    await flushAsyncWork(3)
    staleAfterRender.disconnectedCallback()
    afterRender.resolve({ svg: '<svg>late</svg>' })
    await flushAsyncWork()

    expect(staleAfterRender.innerHTML).not.toContain('late')

    const failure = createDiagram({
      kind: 'mermaid',
      source: encodeText('graph TD;C-->D'),
    })
    document.body.append(failure)
    await flushAsyncWork()

    expect(failure.textContent).toContain('MERMAID rendering failed.')
    expect(failure.textContent).toContain('boom')
  })

  it('renders dbml diagrams, rerenders with cleanup, and reports empty output', async () => {
    runtime.loadMermaid.mockReset()
    runtime.loadDiagramRuntime.mockReset()

    const destroy = vi.fn()
    const onerror = vi.fn()
    const renderDot = vi.fn((_dot: string, done: () => void) => done())
    const graphviz = { onerror, renderDot, destroy }
    const graphvizFactory = vi.fn(() => graphviz)
    const select = vi.fn(() => ({ graphviz: graphvizFactory }))

    runtime.loadDiagramRuntime
      .mockResolvedValueOnce({
        dbmlRun: vi.fn(() => 'digraph { a -> b }'),
        select,
      })
      .mockResolvedValueOnce({
        dbmlRun: vi.fn(() => 'digraph { a -> c }'),
        select,
      })
      .mockResolvedValueOnce({
        dbmlRun: vi.fn(() => '   '),
        select: vi.fn(),
      })

    await ensureElementImported()

    const element = createDiagram({
      kind: 'dbml',
      source: encodeText('Table users {}'),
    })
    document.body.append(element)
    await flushAsyncWork()

    expect(element.querySelector('.markee-diagram-dbml')).not.toBeNull()
    expect(select).toHaveBeenCalled()
    expect(onerror).toHaveBeenCalled()

    element.connectedCallback()
    await flushAsyncWork()
    expect(destroy).toHaveBeenCalled()

    const empty = createDiagram({
      kind: 'dbml',
      source: encodeText('Table posts {}'),
    })
    document.body.append(empty)
    await flushAsyncWork()

    expect(empty.textContent).toContain(
      'DBML rendering produced an empty graph.',
    )
  })

  it('handles stale dbml work and graphviz failures', async () => {
    runtime.loadMermaid.mockReset()
    runtime.loadDiagramRuntime.mockReset()

    const beforeRuntime = createDeferred<{
      dbmlRun: ReturnType<typeof vi.fn>
      select: ReturnType<typeof vi.fn>
    }>()
    const dbmlRun = vi.fn(() => 'digraph { a -> b }')
    const afterRenderDone = createDeferred<void>()
    const destroy = vi.fn()
    const lateGraphviz = {
      onerror: vi.fn(),
      renderDot: vi.fn((_dot: string, done: () => void) => {
        afterRenderDone.promise.then(done)
      }),
      destroy,
    }
    const selectLate = vi.fn(() => ({
      graphviz: vi.fn(() => lateGraphviz),
    }))
    const errorGraphviz = {
      onerror(handler: (message: string) => void) {
        handler('bad graph')
      },
      renderDot: vi.fn(),
    }

    runtime.loadDiagramRuntime
      .mockReturnValueOnce(beforeRuntime.promise)
      .mockResolvedValueOnce({
        dbmlRun: vi.fn(() => 'digraph { b -> c }'),
        select: selectLate,
      })
      .mockResolvedValueOnce({
        dbmlRun: vi.fn(() => 'digraph { c -> d }'),
        select: vi.fn(() => ({
          graphviz: vi.fn(() => errorGraphviz),
        })),
      })
      .mockResolvedValueOnce({
        dbmlRun,
        select: vi.fn(() => {
          throw new Error('select failed')
        }),
      })

    await ensureElementImported()

    const staleBeforeRuntime = createDiagram({
      kind: 'dbml',
      source: encodeText('Table stale {}'),
    })
    document.body.append(staleBeforeRuntime)
    staleBeforeRuntime.disconnectedCallback()
    beforeRuntime.resolve({ dbmlRun, select: vi.fn() })
    await flushAsyncWork()
    expect(dbmlRun).not.toHaveBeenCalled()

    const staleAfterRender = createDiagram({
      kind: 'dbml',
      source: encodeText('Table late {}'),
    })
    document.body.append(staleAfterRender)
    await flushAsyncWork(3)
    staleAfterRender.disconnectedCallback()
    afterRenderDone.resolve()
    await flushAsyncWork()

    expect(destroy).toHaveBeenCalled()
    expect(staleAfterRender.textContent).not.toContain('Diagram error')

    const graphvizFailure = createDiagram({
      kind: 'dbml',
      source: encodeText('Table broken {}'),
    })
    document.body.append(graphvizFailure)
    await flushAsyncWork()

    expect(graphvizFailure.textContent).toContain('DBML rendering failed.')
    expect(graphvizFailure.textContent).toContain('bad graph')

    const selectFailure = createDiagram({
      kind: 'dbml',
      source: encodeText('Table explode {}'),
    })
    document.body.append(selectFailure)
    await flushAsyncWork()

    expect(selectFailure.textContent).toContain('select failed')
  })
})
