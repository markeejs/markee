import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  MarkeeOption as IMarkeeOption,
  MarkeeSelect as IMarkeeSelect,
} from './markee-select'
import { floatingUi } from '../utils/floating-ui'
import { MarkeeSelect } from './markee-select'

const floatingSpies = {
  autoUpdateCleanup: vi.fn(),
}

vi.spyOn(floatingUi, 'autoUpdate').mockImplementation(
  () => floatingSpies.autoUpdateCleanup,
)
vi.spyOn(floatingUi, 'computePosition').mockImplementation(
  async (
    ...[_reference, floating, options]: Parameters<
      typeof floatingUi.computePosition
    >
  ) => {
    const sizeMiddleware = (options?.middleware as any[] | undefined)?.find(
      (middleware: any) => typeof middleware?.apply === 'function',
    )

    sizeMiddleware?.apply?.({
      rects: { reference: { width: 111 } },
      elements: { floating },
    })

    return {
      x: 12,
      y: 24,
      placement: 'bottom-start',
      strategy: 'absolute',
      middlewareData: {},
    } as Awaited<ReturnType<typeof floatingUi.computePosition>>
  },
)
vi.spyOn(floatingUi, 'flip').mockImplementation(() => ({ name: 'flip' }) as any)
vi.spyOn(floatingUi, 'offset').mockImplementation(
  (value: Parameters<typeof floatingUi.offset>[0]) =>
    ({ name: 'offset', value }) as any,
)
vi.spyOn(floatingUi, 'shift').mockImplementation(
  (options: Parameters<typeof floatingUi.shift>[0]) =>
    ({ name: 'shift', options }) as any,
)
vi.spyOn(floatingUi, 'size').mockImplementation(
  (options: unknown) => options as any,
)

function renderSelect(markup: string) {
  document.body.innerHTML = markup
  const select = document.body.querySelector('markee-select')
  if (!(select instanceof MarkeeSelect)) {
    throw new Error('markee-select was not rendered')
  }
  return select
}

function getTrigger(select: HTMLElement) {
  const trigger = select.querySelector('button')
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error('trigger button not found')
  }
  return trigger
}

function getPanel(select: HTMLElement) {
  const panel = select.querySelector('[role="listbox"]')
  if (!(panel instanceof HTMLDivElement)) {
    throw new Error('listbox panel not found')
  }
  return panel
}

function getOptionsRoot(select: HTMLElement) {
  const root = getPanel(select).firstElementChild
  if (!(root instanceof HTMLDivElement)) {
    throw new Error('options root not found')
  }
  return root
}

function keydown(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, composed: true })
}

function pointerdown(): Event {
  return new Event('pointerdown', { bubbles: true, composed: true })
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('markee-option', () => {
  it('reflects properties to attributes and syncs accessibility state', () => {
    const option = document.createElement('markee-option') as IMarkeeOption
    const unset = document.createElement('markee-option') as IMarkeeOption

    option.setAttribute('role', 'presentation')
    option.setAttribute('tabindex', '0')
    option.value = 'alpha'
    option.disabled = true
    option.selected = true

    document.body.append(option)

    expect(unset.value).toBe('')
    expect(option.value).toBe('alpha')
    expect(option.disabled).toBe(true)
    expect(option.selected).toBe(true)
    expect(option.getAttribute('role')).toBe('presentation')
    expect(option.getAttribute('tabindex')).toBe('0')
    expect(option.getAttribute('aria-disabled')).toBe('true')
    expect(option.getAttribute('aria-selected')).toBe('true')

    option.disabled = false
    option.selected = false

    expect(option.getAttribute('aria-disabled')).toBe('false')
    expect(option.getAttribute('aria-selected')).toBe('false')
  })
})

describe('markee-select', () => {
  it('handles pre-connect attributes and reconnects without duplicating structure', () => {
    const select = document.createElement('markee-select') as IMarkeeSelect
    const alpha = document.createElement('markee-option') as IMarkeeOption
    const beta = document.createElement('markee-option') as IMarkeeOption

    select.placeholder = 'Pick one'
    select.value = 'missing'

    alpha.value = 'alpha'
    alpha.textContent = 'Alpha'
    beta.value = 'beta'
    beta.textContent = 'Beta'

    select.append(alpha, beta)
    document.body.append(select)

    expect(getTrigger(select).textContent).toContain('Pick one')
    expect(getTrigger(select).hasAttribute('disabled')).toBe(false)
    expect(getPanel(select).querySelectorAll('markee-option')).toHaveLength(2)

    select.disabled = true
    expect(getTrigger(select).hasAttribute('disabled')).toBe(true)

    document.body.removeChild(select)
    document.body.append(select)

    expect(select.querySelectorAll('button')).toHaveLength(1)
    expect(select.querySelectorAll('[role="listbox"]')).toHaveLength(1)
  })

  it('renders selected content in both text and html modes', () => {
    const select = renderSelect(`
      <markee-select value="beta">
        <markee-option value="alpha"> Alpha </markee-option>
        <markee-option value="beta"><strong>Beta</strong></markee-option>
      </markee-select>
    `)

    const trigger = getTrigger(select)

    expect(trigger.firstElementChild?.textContent).toBe('Beta')

    select.value = 'beta'
    select.displayHtml = true

    expect(trigger.firstElementChild?.innerHTML).toContain(
      '<strong>Beta</strong>',
    )

    select.placeholder = 'Choose'
    select.value = ''

    expect(trigger.textContent).toContain('Choose')
  })

  it('falls back to direct child options when the panel is empty', () => {
    const select = renderSelect(`
      <markee-select value="alpha">
        <markee-option value="alpha">Alpha</markee-option>
        <markee-option value="beta">Beta</markee-option>
      </markee-select>
    `)

    for (const option of Array.from(getOptionsRoot(select).children)) {
      select.append(option)
    }

    select.value = 'beta'

    const directChildren = Array.from(
      select.querySelectorAll(':scope > markee-option'),
    ) as IMarkeeOption[]

    expect(directChildren).toHaveLength(2)
    expect(directChildren[1].hasAttribute('selected')).toBe(true)
  })

  it('supports trigger and panel keyboard interaction', async () => {
    const select = renderSelect(`
      <markee-select value="gamma">
        <markee-option value="alpha">Alpha</markee-option>
        <markee-option value="beta" disabled>Beta</markee-option>
        <markee-option value="gamma">Gamma</markee-option>
      </markee-select>
    `)

    const trigger = getTrigger(select)
    const panel = getPanel(select)
    const [alpha, beta, gamma] = Array.from(
      select.querySelectorAll('markee-option'),
    ) as IMarkeeOption[]
    const onChange = vi.fn()

    select.addEventListener('change', onChange)
    trigger.dispatchEvent(keydown('ArrowDown'))
    await flushMicrotasks()

    expect(panel.dataset.open).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(gamma.hasAttribute('data-active')).toBe(true)
    expect(getPanel(select).style.minWidth).toBe('111px')
    expect(getPanel(select).dataset.placement).toBe('bottom-start')
    expect(getPanel(select).dataset.strategy).toBe('absolute')

    trigger.dispatchEvent(keydown('ArrowDown'))
    expect(alpha.hasAttribute('data-active')).toBe(true)
    expect(beta.hasAttribute('data-active')).toBe(false)

    trigger.dispatchEvent(keydown('ArrowUp'))
    expect(gamma.hasAttribute('data-active')).toBe(true)

    trigger.dispatchEvent(keydown(' '))
    expect(onChange).not.toHaveBeenCalled()
    expect(panel.dataset.open).toBe('false')

    trigger.dispatchEvent(keydown('ArrowUp'))
    expect(panel.dataset.open).toBe('true')

    trigger.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    )
    expect(panel.dataset.open).toBe('false')

    trigger.dispatchEvent(keydown('Enter'))
    panel.dispatchEvent(keydown('ArrowDown'))
    panel.dispatchEvent(keydown('x'))
    panel.dispatchEvent(keydown('Enter'))

    expect(select.value).toBe('alpha')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(alpha.hasAttribute('selected')).toBe(true)
    expect(gamma.hasAttribute('selected')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('handles document and pointer interactions while open', async () => {
    const select = renderSelect(`
      <markee-select>
        <markee-option value="alpha">Alpha</markee-option>
        <markee-option value="beta">Beta</markee-option>
      </markee-select>
    `)

    const trigger = getTrigger(select)
    const panel = getPanel(select)

    document.body.dispatchEvent(pointerdown())
    document.dispatchEvent(keydown('Escape'))
    trigger.click()
    await flushMicrotasks()

    select.dispatchEvent(pointerdown())
    expect(panel.dataset.open).toBe('true')

    document.dispatchEvent(keydown('a'))
    expect(panel.dataset.open).toBe('true')

    document.body.dispatchEvent(pointerdown())
    expect(panel.dataset.open).toBe('false')
    expect(document.activeElement).not.toBe(trigger)

    trigger.click()
    await flushMicrotasks()
    document.dispatchEvent(keydown('Escape'))

    expect(panel.dataset.open).toBe('false')
    expect(document.activeElement).toBe(trigger)
    expect(floatingUi.autoUpdate).toHaveBeenCalledTimes(2)
    expect(floatingSpies.autoUpdateCleanup).toHaveBeenCalledTimes(2)
  })

  it('ignores disabled interactions and all-disabled option lists', async () => {
    const select = renderSelect(`
      <markee-select disabled>
        <markee-option value="alpha" disabled>Alpha</markee-option>
        <markee-option value="beta" disabled>Beta</markee-option>
      </markee-select>
    `)

    const trigger = getTrigger(select)
    const panel = getPanel(select)
    const onChange = vi.fn()

    select.addEventListener('change', onChange)

    trigger.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    )
    trigger.dispatchEvent(keydown('ArrowDown'))

    expect(panel.dataset.open).toBe('false')

    select.disabled = false
    trigger.click()
    await flushMicrotasks()

    expect(panel.dataset.open).toBe('true')
    expect(select.querySelector('[data-active]')).toBeNull()

    ;(
      select.querySelectorAll('markee-option')[0] as IMarkeeOption
    ).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    panel.dispatchEvent(keydown('ArrowDown'))
    panel.dispatchEvent(keydown('ArrowUp'))
    panel.dispatchEvent(keydown(' '))
    panel.dispatchEvent(keydown('Escape'))
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ;(select.querySelector('markee-option') as IMarkeeOption).click()

    expect(select.value).toBe('')
    expect(onChange).not.toHaveBeenCalled()
    expect(panel.dataset.open).toBe('false')
  })

  it('selects an enabled option from panel clicks and handles empty text content', async () => {
    const select = renderSelect(`
      <markee-select>
        <markee-option value="alpha">Alpha</markee-option>
        <markee-option value="beta"></markee-option>
      </markee-select>
    `)

    const trigger = getTrigger(select)
    const panel = getPanel(select)
    const [, beta] = Array.from(select.querySelectorAll('markee-option')) as [
      IMarkeeOption,
      IMarkeeOption,
    ]
    const onChange = vi.fn()

    Object.defineProperty(beta, 'textContent', {
      configurable: true,
      get: () => null,
    })

    select.addEventListener('change', onChange)

    trigger.click()
    await flushMicrotasks()
    beta.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    )

    expect(select.value).toBe('beta')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(panel.dataset.open).toBe('false')
    expect(trigger.firstElementChild?.textContent).toBe('')
  })

  it('reconciles dropped values across non-relevant and relevant mutations', async () => {
    const originalMutationObserver = globalThis.MutationObserver
    const originalQueueMicrotask = globalThis.queueMicrotask

    const queued: Array<() => void> = []
    const observers: Array<{
      callback: MutationCallback
      observe: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
      trigger: (records: MutationRecord[]) => void
    }> = []

    class FakeMutationObserver {
      callback: MutationCallback
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(callback: MutationCallback) {
        this.callback = callback
        observers.push(this)
      }

      trigger(records: MutationRecord[]) {
        this.callback(records, this as never)
      }
    }

    globalThis.MutationObserver = FakeMutationObserver as never
    globalThis.queueMicrotask = vi.fn((callback: () => void) => {
      queued.push(callback)
    })

    try {
      const select = document.createElement('markee-select') as IMarkeeSelect
      const alpha = document.createElement('markee-option') as IMarkeeOption
      alpha.value = 'alpha'
      alpha.textContent = 'Alpha'
      select.append(alpha)
      select.value = 'missing'
      document.body.append(select)

      const observer = observers[0]
      const optionsRoot = getOptionsRoot(select)
      const nestedMatch = document.createElement(
        'markee-option',
      ) as IMarkeeOption
      nestedMatch.value = 'missing'
      nestedMatch.textContent = 'Missing'
      const appended = document.createElement('markee-option') as IMarkeeOption
      appended.value = 'delta'
      appended.textContent = 'Delta'
      const wrapper = document.createElement('div')
      wrapper.append(nestedMatch)
      const removable = document.createElement('x-option')
      const onChange = vi.fn()

      select.addEventListener('change', onChange)

      expect(select.value).toBe('')

      const appendChild = optionsRoot.appendChild.bind(optionsRoot)
      const appendSpy = vi
        .spyOn(optionsRoot, 'appendChild')
        .mockImplementation(((node: Node) => {
          const result = appendChild(node)
          observer.trigger([
            {
              addedNodes: [document.createTextNode('ignored')],
              removedNodes: [],
            } as unknown as MutationRecord,
          ])
          return result
        }) as typeof optionsRoot.appendChild)

      optionsRoot.append(wrapper)
      select.append(appended)
      getTrigger(select).click()
      await flushMicrotasks()

      observer.trigger([
        {
          addedNodes: [document.createTextNode('plain')],
          removedNodes: [],
        } as unknown as MutationRecord,
      ])

      observer.trigger([
        {
          addedNodes: [document.createElement('div')],
          removedNodes: [],
        } as unknown as MutationRecord,
      ])

      observer.trigger([
        {
          addedNodes: [wrapper],
          removedNodes: [],
        } as unknown as MutationRecord,
      ])

      observer.trigger([
        {
          addedNodes: [],
          removedNodes: [removable],
        } as unknown as MutationRecord,
      ])

      for (const callback of queued.splice(0)) callback()

      expect(select.value).toBe('missing')
      expect(onChange).not.toHaveBeenCalled()
      expect(appendSpy).toHaveBeenCalled()
      expect(select.querySelector('markee-option[data-active]')).not.toBeNull()

      appendSpy.mockRestore()
      document.body.removeChild(select)

      expect(observer.disconnect).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.MutationObserver = originalMutationObserver
      globalThis.queueMicrotask = originalQueueMicrotask
    }
  })

  it('clears the selected value when a relevant removed mutation removes the option', async () => {
    const originalMutationObserver = globalThis.MutationObserver

    const observers: Array<{
      callback: MutationCallback
      trigger: (records: MutationRecord[]) => void
    }> = []

    class FakeMutationObserver {
      callback: MutationCallback

      constructor(callback: MutationCallback) {
        this.callback = callback
        observers.push(this)
      }

      observe() {}
      disconnect() {}

      trigger(records: MutationRecord[]) {
        this.callback(records, this as never)
      }
    }

    globalThis.MutationObserver = FakeMutationObserver as never

    try {
      const select = document.createElement('markee-select') as IMarkeeSelect
      const alpha = document.createElement('markee-option') as IMarkeeOption
      const wrapper = document.createElement('div')
      const gamma = document.createElement('markee-option') as IMarkeeOption
      const onChange = vi.fn()

      alpha.value = 'alpha'
      alpha.textContent = 'Alpha'
      gamma.value = 'gamma'
      gamma.textContent = 'Gamma'
      wrapper.append(gamma)

      select.append(alpha)
      document.body.append(select)
      getOptionsRoot(select).append(wrapper)
      select.value = 'gamma'
      select.addEventListener('change', onChange)

      wrapper.remove()
      observers[0].trigger([
        {
          addedNodes: [],
          removedNodes: [wrapper],
        } as unknown as MutationRecord,
      ])

      await flushMicrotasks()

      expect(select.value).toBe('')
      expect(onChange).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.MutationObserver = originalMutationObserver
    }
  })

  it('renders the placeholder when the current value no longer matches an option', () => {
    const originalMutationObserver = globalThis.MutationObserver

    class FakeMutationObserver {
      constructor(_callback: MutationCallback) {}
      observe() {}
      disconnect() {}
    }

    globalThis.MutationObserver = FakeMutationObserver as never

    try {
      const select = document.createElement('markee-select') as IMarkeeSelect
      const alpha = document.createElement('markee-option') as IMarkeeOption

      alpha.value = 'alpha'
      alpha.textContent = 'Alpha'

      select.placeholder = 'Fallback'
      select.append(alpha)
      document.body.append(select)
      select.value = 'alpha'

      alpha.remove()
      select.displayHtml = true

      expect(getTrigger(select).textContent).toContain('Fallback')
    } finally {
      globalThis.MutationObserver = originalMutationObserver
    }
  })
})
