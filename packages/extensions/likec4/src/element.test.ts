import { describe, expect, it, vi } from 'vitest'

import { encodeText, MAX_VIEW_HEIGHT } from './helpers.js'

const runtime = vi.hoisted(() => ({
  loadLikeC4Runtime: vi.fn(),
}))

vi.mock('./runtime.js', () => ({
  loadLikeC4Runtime: runtime.loadLikeC4Runtime,
}))

let elementImport: Promise<void> | null = null

async function ensureElementImported() {
  elementImport ??= import('./element.js').then(({ registerLikeC4Element }) => {
    registerLikeC4Element()
  })
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

function createLikeC4(dataset: Record<string, string>) {
  const element = document.createElement('markee-likec4') as HTMLElement & {
    connectedCallback(): void
    disconnectedCallback(): void
  }
  Object.assign(element.dataset, dataset)
  return element
}

function createRuntimeApi(likec4: {
  getErrors(): any[]
  diagrams(): Promise<any[]>
  layoutedModel(): Promise<any>
  dispose(): Promise<unknown>
}) {
  const root = {
    render: vi.fn(),
    unmount: vi.fn(),
  }
  const createElement = vi.fn(
    (type: unknown, props: unknown, ...children: unknown[]) => ({
      type,
      props,
      children,
    }),
  )
  const api = {
    createRoot: vi.fn(() => root),
    createElement,
    fromSource: vi.fn(async () => likec4),
    LikeC4ModelProvider: Symbol('provider'),
    LikeC4View: Symbol('view'),
  }

  return { api, root, createElement }
}

describe('@markee/likec4 element', () => {
  it('loads the custom element definition and handles missing or invalid sources', async () => {
    runtime.loadLikeC4Runtime.mockReset()
    await ensureElementImported()

    expect(
      window.customElements.get('markee-likec4') as CustomElementConstructor,
    ).toBeDefined()

    const missing = createLikeC4({})
    document.body.append(missing)
    await flushAsyncWork()
    expect(missing.textContent).toContain('Missing LikeC4 source.')

    const invalid = createLikeC4({ source: '%' })
    document.body.append(invalid)
    await flushAsyncWork()
    expect(invalid.textContent).toContain('Could not decode LikeC4 source.')
  })

  it('reports parsing errors and runtime failures and always disposes models', async () => {
    runtime.loadLikeC4Runtime.mockReset()

    const parsingLikeC4 = {
      getErrors: vi.fn(() => [
        { line: 1, message: 'bad first line' },
        { message: 'generic failure' },
      ]),
      diagrams: vi.fn(),
      layoutedModel: vi.fn(),
      dispose: vi.fn().mockRejectedValue(new Error('dispose failed')),
    }
    const parsingRuntime = createRuntimeApi(parsingLikeC4)

    runtime.loadLikeC4Runtime
      .mockResolvedValueOnce(parsingRuntime.api)
      .mockRejectedValueOnce(new Error('runtime exploded'))

    await ensureElementImported()

    const parsing = createLikeC4({ source: encodeText('model {}') })
    document.body.append(parsing)
    await flushAsyncWork()

    expect(parsing.textContent).toContain('LikeC4 parsing failed.')
    expect(parsing.textContent).toContain('Line 2: bad first line')
    expect(parsing.textContent).toContain('generic failure')
    expect(parsingLikeC4.dispose).toHaveBeenCalled()

    const failure = createLikeC4({ source: encodeText('model { broken }') })
    document.body.append(failure)
    await flushAsyncWork()

    expect(failure.textContent).toContain('LikeC4 rendering failed.')
    expect(failure.textContent).toContain('runtime exploded')
  })

  it('renders selected views, supports navigation, and ignores duplicate connected callbacks', async () => {
    runtime.loadLikeC4Runtime.mockReset()

    const likec4 = {
      getErrors: vi.fn(() => []),
      diagrams: vi.fn(async () => [{ id: 'overview' }, { id: 'detail' }]),
      layoutedModel: vi.fn(async () => ({ model: true })),
      dispose: vi.fn(async () => undefined),
    }
    const viewRuntime = createRuntimeApi(likec4)
    runtime.loadLikeC4Runtime.mockResolvedValueOnce(viewRuntime.api)

    await ensureElementImported()

    const element = createLikeC4({
      source: encodeText('model { }\n'),
      view: 'detail',
      zoom: 'true',
      pan: 'true',
      maxHeight: '40rem',
    })
    document.body.append(element)
    await flushAsyncWork()

    element.connectedCallback()

    const firstViewCall = viewRuntime.createElement.mock.calls.findLast(
      ([type]) => type === viewRuntime.api.LikeC4View,
    )
    const props = firstViewCall?.[1] as Record<string, any>

    expect(props).toMatchObject({
      viewId: 'detail',
      zoomable: true,
      pannable: true,
      controls: true,
      browser: false,
      style: {
        '--likec4-view-max-height': '40rem',
        'maxHeight': '40rem',
      },
    })

    const renderCount = viewRuntime.root.render.mock.calls.length
    props.onNavigateTo(undefined)
    props.onNavigateTo('detail')
    expect(viewRuntime.root.render.mock.calls.length).toBe(renderCount)

    props.onNavigateTo('overview')
    const secondViewCall = viewRuntime.createElement.mock.calls.findLast(
      ([type]) => type === viewRuntime.api.LikeC4View,
    )
    expect((secondViewCall?.[1] as Record<string, any>)?.viewId).toBe(
      'overview',
    )
  })

  it('disables interactions inside lightbox triggers and omits styles inside the lightbox body', async () => {
    runtime.loadLikeC4Runtime.mockReset()

    const wrappedLikeC4 = {
      getErrors: vi.fn(() => []),
      diagrams: vi.fn(async () => [{ id: 'one' }, { id: 'two' }]),
      layoutedModel: vi.fn(async () => ({ wrapped: true })),
      dispose: vi.fn(async () => undefined),
    }
    const wrappedRuntime = createRuntimeApi(wrappedLikeC4)
    const lightboxLikeC4 = {
      getErrors: vi.fn(() => []),
      diagrams: vi.fn(async () => [{ id: 'solo' }]),
      layoutedModel: vi.fn(async () => ({ solo: true })),
      dispose: vi.fn(async () => undefined),
    }
    const lightboxRuntime = createRuntimeApi(lightboxLikeC4)

    runtime.loadLikeC4Runtime
      .mockResolvedValueOnce(wrappedRuntime.api)
      .mockResolvedValueOnce(lightboxRuntime.api)

    await ensureElementImported()

    const wrapper = document.createElement('a')
    wrapper.className = 'glightbox'
    const wrapped = createLikeC4({
      source: encodeText('model {}'),
      zoom: 'true',
      pan: 'true',
      maxHeight: 'invalid',
    })
    wrapper.append(wrapped)
    document.body.append(wrapper)
    await flushAsyncWork()

    const wrappedProps = wrappedRuntime.createElement.mock.calls.findLast(
      ([type]) => type === wrappedRuntime.api.LikeC4View,
    )?.[1] as Record<string, any>

    expect(wrappedProps).toMatchObject({
      zoomable: false,
      pannable: false,
      controls: false,
      style: {
        '--likec4-view-max-height': MAX_VIEW_HEIGHT,
        'maxHeight': MAX_VIEW_HEIGHT,
      },
    })

    const lightboxBody = document.createElement('div')
    lightboxBody.id = 'glightbox-body'
    const insideLightbox = createLikeC4({
      source: encodeText('view solo {}'),
    })
    lightboxBody.append(insideLightbox)
    document.body.append(lightboxBody)
    await flushAsyncWork()

    const lightboxProps = lightboxRuntime.createElement.mock.calls.findLast(
      ([type]) => type === lightboxRuntime.api.LikeC4View,
    )?.[1] as Record<string, any>

    expect(lightboxProps.viewId).toBe('solo')
    expect(lightboxProps.style).toBeUndefined()
  })

  it('reports missing views and stops stale work before runtime resolution and before final rendering', async () => {
    runtime.loadLikeC4Runtime.mockReset()

    const beforeRuntime = createDeferred<any>()
    const root = {
      render: vi.fn(),
      unmount: vi.fn(),
    }
    const afterLayout = createDeferred<{ layouted: true }>()
    const lateLikeC4 = {
      getErrors: vi.fn(() => []),
      diagrams: vi.fn(async () => [{ id: 'late' }]),
      layoutedModel: vi.fn(() => afterLayout.promise),
      dispose: vi.fn(async () => undefined),
    }
    const lateRuntime = {
      createRoot: vi.fn(() => root),
      createElement: vi.fn(
        (type: unknown, props: unknown, ...children: unknown[]) => ({
          type,
          props,
          children,
        }),
      ),
      fromSource: vi.fn(async () => lateLikeC4),
      LikeC4ModelProvider: Symbol('provider'),
      LikeC4View: Symbol('view'),
    }
    const emptyLikeC4 = {
      getErrors: vi.fn(() => []),
      diagrams: vi.fn(async () => []),
      layoutedModel: vi.fn(async () => ({})),
      dispose: vi.fn(async () => undefined),
    }
    const emptyRuntime = createRuntimeApi(emptyLikeC4)

    runtime.loadLikeC4Runtime
      .mockReturnValueOnce(beforeRuntime.promise)
      .mockResolvedValueOnce(lateRuntime)
      .mockResolvedValueOnce(emptyRuntime.api)

    await ensureElementImported()

    const staleBeforeRuntime = createLikeC4({ source: encodeText('model {}') })
    document.body.append(staleBeforeRuntime)
    staleBeforeRuntime.disconnectedCallback()
    beforeRuntime.resolve(
      createRuntimeApi({
        getErrors: vi.fn(() => []),
        diagrams: vi.fn(async () => [{ id: 'ignored' }]),
        layoutedModel: vi.fn(async () => ({})),
        dispose: vi.fn(async () => undefined),
      }).api,
    )
    await flushAsyncWork()

    const staleBeforeFinalRender = createLikeC4({
      source: encodeText('model {}'),
    })
    document.body.append(staleBeforeFinalRender)
    await flushAsyncWork(3)
    staleBeforeFinalRender.disconnectedCallback()
    afterLayout.resolve({ layouted: true })
    await flushAsyncWork()

    expect(root.render).toHaveBeenCalledTimes(1)

    const empty = createLikeC4({ source: encodeText('model {}') })
    document.body.append(empty)
    await flushAsyncWork()

    expect(empty.textContent).toContain('No views were found.')
  })
})
