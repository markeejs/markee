import { describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => {
  const payloadFor = vi.fn()
  const pluginConfigFor = vi.fn()
  const readCache = vi.fn()
  const writeCache = vi.fn()
  const loadKrokiDiagram = vi.fn()
  const valueCache = new Map<string, string>()
  const nothing = Symbol.for('markee-kroki-nothing')
  return {
    payloadFor,
    pluginConfigFor,
    readCache,
    writeCache,
    loadKrokiDiagram,
    valueCache,
    nothing,
  }
})

class FakeMarkeeElement extends HTMLElement {
  static with() {
    return this
  }

  connectedCallback() {}
}

vi.mock('lit', () => ({
  html: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (out, part, index) => out + part + (values[index] ?? ''),
      '',
    ),
  nothing: runtime.nothing,
}))
vi.mock('lit/directives/unsafe-html.js', () => ({
  unsafeHTML: (value: string) => value,
}))
vi.mock('@markee/runtime', () => ({
  state: {
    $payload: {
      get: () => ({ for: runtime.payloadFor }),
    },
    $pluginConfig: {
      get: () => ({ for: runtime.pluginConfigFor }),
    },
  },
  MarkeeElement: FakeMarkeeElement,
}))
vi.mock('../shared/cache.mjs', () => ({
  readCache: runtime.readCache,
  writeCache: runtime.writeCache,
  valueCache: runtime.valueCache,
}))
vi.mock('../shared/kroki-resolver.mjs', () => ({
  loadKrokiDiagram: runtime.loadKrokiDiagram,
}))

let krokiImport: Promise<void> | null = null

async function ensureKrokiImported() {
  krokiImport ??= import('./kroki.mjs').then(() => undefined)
  await krokiImport
}

function createElementInstance() {
  return document.createElement('markee-kroki') as HTMLElement & {
    render(): unknown
    updated(): void
    value?: string
    error?: unknown
  }
}

async function flushAsyncWork(iterations = 5) {
  for (let index = 0; index < iterations; index++) {
    await Promise.resolve()
  }
}

describe('@markee/kroki element', () => {
  it('loads the custom element definition', async () => {
    await ensureKrokiImported()

    const Constructor = window.customElements.get(
      'markee-kroki',
    ) as CustomElementConstructor & {
      properties: Record<string, unknown>
    }

    expect(Constructor).toBeDefined()
    expect(Constructor.properties).toMatchObject({
      value: { state: true },
      error: { state: true },
    })
  })

  it('renders nothing inside the lightbox body and updates svg backgrounds', async () => {
    runtime.payloadFor.mockReset()
    runtime.pluginConfigFor.mockReset()
    runtime.readCache.mockReset()
    runtime.writeCache.mockReset()
    runtime.loadKrokiDiagram.mockReset()
    runtime.valueCache.clear()
    await ensureKrokiImported()

    const wrapper = document.createElement('div')
    wrapper.id = 'glightbox-body'
    const element = createElementInstance()
    wrapper.append(element)
    document.body.append(wrapper)

    expect(element.render()).toBe(runtime.nothing)

    element.innerHTML = '<svg style="background:red"></svg>'
    element.updated()

    expect((element.querySelector('svg') as SVGElement).style.background).toBe(
      '',
    )
  })

  it('reads cached content, falls back to fetching, writes successful results, and reports fetch failures', async () => {
    runtime.payloadFor.mockReset()
    runtime.pluginConfigFor.mockReset()
    runtime.readCache.mockReset()
    runtime.writeCache.mockReset()
    runtime.loadKrokiDiagram.mockReset()
    runtime.valueCache.clear()
    runtime.payloadFor.mockReset()
    runtime.pluginConfigFor.mockReset()
    runtime.pluginConfigFor.mockReturnValue({ serverUrl: 'https://kroki.io' })
    runtime.readCache
      .mockRejectedValueOnce(new Error('miss'))
      .mockResolvedValueOnce('<svg>cached</svg>')
      .mockRejectedValueOnce(new Error('boom'))
    runtime.loadKrokiDiagram
      .mockResolvedValueOnce('<svg>ok</svg>')
      .mockRejectedValueOnce(new Error('fetch failed'))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await ensureKrokiImported()

    const first = createElementInstance()
    first.id = 'first'
    first.className = 'mermaid kroki'
    runtime.valueCache.set('first', 'graph TD;A-->B')
    document.body.append(first)
    await flushAsyncWork()

    expect((first as any).value).toBe('<svg>ok</svg>')
    expect(runtime.writeCache).toHaveBeenCalledWith(
      'mermaid;graph TD;A-->B',
      '<svg>ok</svg>',
    )

    const second = createElementInstance()
    second.id = 'second'
    second.className = 'kroki'
    runtime.valueCache.set('second', 'graph LR;A-->B')
    document.body.append(second)
    await flushAsyncWork()

    expect((second as any).value).toBe('<svg>cached</svg>')

    const third = createElementInstance()
    third.id = 'third'
    third.className = 'kroki'
    runtime.valueCache.set('third', 'broken')
    document.body.append(third)
    await flushAsyncWork()

    expect(String((third as any).error)).toContain('fetch failed')
    expect(log).not.toHaveBeenCalledWith('No content for kroki', 'first')
  })

  it('uses prerendered payloads, reports missing ids, and handles missing server configuration', async () => {
    runtime.payloadFor.mockReset()
    runtime.pluginConfigFor.mockReset()
    runtime.readCache.mockReset()
    runtime.writeCache.mockReset()
    runtime.loadKrokiDiagram.mockReset()
    runtime.valueCache.clear()
    runtime.payloadFor.mockReset()
    runtime.pluginConfigFor.mockReset()
    runtime.payloadFor
      .mockReturnValueOnce('<svg>pre</svg>')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
    runtime.pluginConfigFor.mockReturnValue({})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await ensureKrokiImported()

    const prerendered = createElementInstance()
    prerendered.id = 'pre'
    document.body.append(prerendered)

    expect((prerendered as any).value).toBe('<svg>pre</svg>')
    expect(prerendered.render()).toContain('<svg>pre</svg>')

    const missingConfig = createElementInstance()
    missingConfig.id = 'cfg'
    runtime.valueCache.set('cfg', 'graph TD;A-->B')
    document.body.append(missingConfig)

    expect(String((missingConfig as any).error)).toContain('serverUrl')
    expect(String(missingConfig.render())).toContain('serverUrl')

    const missingPayload = createElementInstance()
    missingPayload.id = 'missing'
    document.body.append(missingPayload)

    expect(log).toHaveBeenCalledWith('No content for kroki', 'missing')
    expect(String(missingPayload.render())).toContain('Diagram is loading')
  })
})
