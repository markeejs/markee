import { describe, expect, it, vi } from 'vitest'

function createVisit() {
  return vi.fn((tree: any, _type: string, callback: Function) => {
    const walk = (node: any) => {
      if (node?.type === 'element') {
        callback(node)
      }
      if (Array.isArray(node?.children)) {
        node.children.forEach(walk)
      }
    }
    walk(tree)
  })
}

async function waitForMutation() {
  await Promise.resolve()
  await Promise.resolve()
}

let mainImport: Promise<void> | null = null

async function ensureMainImported() {
  mainImport ??= import('./main.js').then(() => undefined)
  await mainImport
}

async function importPluginRegistration() {
  vi.resetModules()

  const rehype = vi.fn()
  const visit = createVisit()

  vi.doMock('@markee/runtime', () => ({
    state: {
      $router: {
        subscribe: vi.fn(() => () => {}),
      },
    },
    extend: {
      markdownPipeline: {
        rehype,
        visit,
      },
    },
  }))

  await import('./main.js')

  return rehype
}

const runtime = vi.hoisted(() => {
  let routeListener: (() => void) | undefined
  return {
    rehype: vi.fn(),
    visit: createVisit(),
    subscribe: vi.fn((listener: () => void) => {
      routeListener = listener
      return () => {}
    }),
    triggerRoute() {
      routeListener?.()
    },
  }
})

vi.mock('@markee/runtime', () => ({
  state: {
    $router: {
      subscribe: runtime.subscribe,
    },
  },
  extend: {
    markdownPipeline: {
      rehype: runtime.rehype,
      visit: runtime.visit,
    },
  },
}))

describe('@markee/placeholders', () => {
  it('loads stored scoped values and syncs placeholders rendered as inputs', async () => {
    sessionStorage.setItem(
      'markee::placeholders::scopes',
      JSON.stringify([['team', [['ScopedToken::team', 'Remembered']]]]),
    )

    await ensureMainImported()

    const remembered = document.createElement('markee-placeholder')
    remembered.dataset.scope = 'team'
    remembered.textContent = 'ScopedToken'

    const mirror = document.createElement('markee-placeholder')
    mirror.dataset.scope = 'team'
    mirror.dataset.tag = 'input'
    mirror.textContent = 'ScopedToken'

    const inputs = document.createElement('markee-placeholder-inputs')
    document.body.append(remembered, mirror, inputs)

    expect(remembered.querySelector('[data-value]')?.textContent).toBe(
      'Remembered',
    )

    const editable = remembered.querySelector(
      '[contenteditable]',
    ) as HTMLElement
    editable.textContent = 'Updated'
    editable.dispatchEvent(new Event('input', { bubbles: true }))

    const tableInput = inputs.querySelector(
      'tbody tr input',
    ) as HTMLInputElement
    tableInput.value = 'Updated'
    tableInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect((mirror.querySelector('input') as HTMLInputElement).value).toBe(
      'Updated',
    )
  })

  it('syncs placeholders through editable values and placeholder inputs', async () => {
    await ensureMainImported()

    const first = document.createElement('markee-placeholder')
    first.textContent = 'Name'
    const second = document.createElement('markee-placeholder')
    second.textContent = 'Name'
    const inputs = document.createElement('markee-placeholder-inputs')

    document.body.append(first, second, inputs)

    const editable = first.querySelector('[contenteditable]') as HTMLElement
    editable.textContent = 'Alice'
    editable.dispatchEvent(new Event('input', { bubbles: true }))

    expect(second.querySelector('[data-value]')?.textContent).toBe('Alice')
    expect(
      inputs.querySelector('tbody tr input') as HTMLInputElement,
    ).toMatchObject({
      value: 'Alice',
    })
    expect(sessionStorage.getItem('markee::placeholders::scopes')).toContain(
      'team',
    )
  })

  it('supports scoped values, router clearing, and input-driven updates', async () => {
    await ensureMainImported()

    const scoped = document.createElement('markee-placeholder-variable')
    scoped.dataset.scope = 'team'
    scoped.textContent = 'ScopedToken'
    const unscoped = document.createElement('markee-placeholder')
    unscoped.textContent = 'RouteToken'
    const inputs = document.createElement('markee-placeholder-inputs')

    document.body.append(scoped, unscoped, inputs)

    const editable = unscoped.querySelector('[contenteditable]') as HTMLElement
    editable.textContent = 'Saved'
    editable.dispatchEvent(new Event('input', { bubbles: true }))

    const firstInput = inputs.querySelector(
      'tbody tr input',
    ) as HTMLInputElement
    firstInput.value = 'Scoped value'
    firstInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(scoped.querySelector('[data-value]')?.textContent).toBe(
      'Scoped value',
    )
    expect(inputs.querySelector('small')?.textContent).toContain('team')
    expect(sessionStorage.getItem('markee::placeholders::scopes')).toContain(
      'Scoped value',
    )

    runtime.triggerRoute()

    const fresh = document.createElement('markee-placeholder')
    fresh.textContent = 'RouteToken'
    document.body.append(fresh)

    expect(fresh.querySelector('[data-value]')?.textContent).toBe('RouteToken')
  })

  it('handles empty placeholders and disconnects unknown instances safely', async () => {
    await ensureMainImported()

    const empty = document.createElement('markee-placeholder')
    Object.defineProperty(empty, 'textContent', {
      configurable: true,
      get: () => null,
    })
    document.body.append(empty)

    expect(empty.querySelector('[data-value]')?.textContent).toBe('')

    const orphan = document.createElement('markee-placeholder')
    ;(orphan as unknown as { value: string }).value = '__missing__'
    expect(() =>
      (
        orphan as unknown as { disconnectedCallback(): void }
      ).disconnectedCallback(),
    ).not.toThrow()
  })

  it('registers a rehype plugin that converts placeholder elements', async () => {
    const rehype = await importPluginRegistration()

    expect(rehype).toHaveBeenCalledWith('placeholders', expect.any(Function))

    const transform = rehype.mock.calls[0]?.[1]()
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'em',
          properties: { placeholder: '', team: '' },
          children: [],
        },
        {
          type: 'element',
          tagName: 'strong',
          properties: { variable: '', global: '' },
          children: [],
        },
        {
          type: 'element',
          tagName: 'code',
          properties: {},
          children: [],
        },
        {
          type: 'element',
          tagName: 'span',
          children: [],
        },
      ],
    }

    transform(tree)

    expect(tree.children[0]).toMatchObject({
      tagName: 'markee-placeholder',
      properties: {
        dataScope: 'team',
        dataTag: 'em',
      },
    })
    expect(tree.children[1]).toMatchObject({
      tagName: 'markee-placeholder-variable',
      properties: {
        dataScope: 'global',
        dataTag: 'strong',
      },
    })
    expect(tree.children[2]).toMatchObject({
      tagName: 'code',
      properties: {},
    })
    expect(tree.children[3]).toMatchObject({
      tagName: 'span',
      children: [],
    })
  })

  it('replaces placeholder markup in eligible code blocks and leaves pre blocks alone', async () => {
    await ensureMainImported()

    const host = document.createElement('div')
    host.setAttribute('tabindex', '0')
    host.innerHTML =
      '<code placeholders>[CodeName]{placeholder} [CodeRole]{variable} [Scoped]{variable scope}</code>'

    const pre = document.createElement('pre')
    pre.innerHTML = '<code placeholders>[Skip]{placeholder}</code>'
    const alreadyProcessed = document.createElement('div')
    alreadyProcessed.setAttribute('tabindex', '0')
    alreadyProcessed.innerHTML =
      '<code placeholders><markee-placeholder>Keep</markee-placeholder></code>'

    document.body.append(host, pre, alreadyProcessed)
    await waitForMutation()

    expect(host.querySelector('markee-placeholder')?.textContent).toBe(
      'CodeName',
    )
    expect(host.querySelector('markee-placeholder-variable')?.textContent).toBe(
      'CodeRole',
    )
    expect(host.innerHTML).toContain('data-scope=')
    expect(pre.querySelector('markee-placeholder')).toBeNull()
    expect(
      alreadyProcessed.querySelector('markee-placeholder')?.textContent,
    ).toBe('Keep')
  })

  it('propagates editable updates into input-tag placeholders', async () => {
    await ensureMainImported()

    const editable = document.createElement('markee-placeholder')
    editable.textContent = 'Name'
    const mirroredInput = document.createElement('markee-placeholder')
    mirroredInput.dataset.tag = 'input'
    mirroredInput.textContent = 'Name'

    document.body.append(editable, mirroredInput)

    const contenteditable = editable.querySelector(
      '[contenteditable]',
    ) as HTMLElement
    contenteditable.textContent = 'Alice'
    contenteditable.dispatchEvent(new Event('input', { bubbles: true }))

    expect(
      (mirroredInput.querySelector('input') as HTMLInputElement).value,
    ).toBe('Alice')
  })
})
