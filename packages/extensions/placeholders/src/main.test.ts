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

await import('./main.js')

describe('@markee/placeholders', () => {
  it('syncs placeholders through editable values and placeholder inputs', async () => {
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
    expect(sessionStorage.getItem('markee::placeholders::scopes')).toBe('[]')
  })

  it('supports scoped values, router clearing, and input-driven updates', async () => {
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
  })

  it('replaces placeholder markup in eligible code blocks and leaves pre blocks alone', async () => {
    const host = document.createElement('div')
    host.setAttribute('tabindex', '0')
    host.innerHTML =
      '<code placeholders>[CodeName]{placeholder} [CodeRole]{variable scope}</code>'

    const pre = document.createElement('pre')
    pre.innerHTML = '<code placeholders>[Skip]{placeholder}</code>'

    document.body.append(host, pre)
    await waitForMutation()

    expect(host.querySelector('markee-placeholder')?.textContent).toBe(
      'CodeName',
    )
    expect(host.querySelector('markee-placeholder-variable')?.textContent).toBe(
      'CodeRole',
    )
    expect(pre.querySelector('markee-placeholder')).toBeNull()
  })
})
