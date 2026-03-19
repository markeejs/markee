import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeState = ((globalThis as any).__markeeColorSchemeRuntimeState ??= {
  colorScheme: 'auto',
})

const colorSchemeSet = vi.fn((value: 'auto' | 'light' | 'dark') => {
  runtimeState.colorScheme = value
})

const { state } = await import('@markee/runtime')
const { MarkeeColorSchemeManager } =
  await import('./markee-color-scheme-manager')

beforeEach(() => {
  runtimeState.colorScheme = 'auto'
  vi.restoreAllMocks()
  colorSchemeSet.mockClear()
  vi.spyOn(state.$colorScheme, 'get').mockImplementation(
    () => runtimeState.colorScheme as any,
  )
  vi.spyOn(state.$colorScheme, 'set').mockImplementation(colorSchemeSet as any)
  vi.spyOn(state.$colorScheme, 'subscribe').mockImplementation(() => () => {})
})

describe('markee-color-scheme-manager', () => {
  it('renders the auto state with the configured title and class', async () => {
    const element = new MarkeeColorSchemeManager()
    element.baseClass = 'base icon'
    element.classAuto = 'auto-icon'
    element.titleAuto = 'Automatic'
    document.body.append(element)

    await element.updateComplete

    expect(element.className).toContain('base')
    expect(element.classList.contains('auto-icon')).toBe(true)
    expect(element.title).toBe('Automatic')
  })

  it('updates classes and titles for light and dark states', async () => {
    const element = new MarkeeColorSchemeManager()
    element.classAuto = 'auto-icon'
    element.classLight = 'light-icon'
    element.classDark = 'dark-icon'
    element.titleLight = 'Bright'
    element.titleDark = 'Dim'
    document.body.append(element)

    runtimeState.colorScheme = 'light'
    await element.requestUpdate()
    await element.updateComplete

    expect(element.classList.contains('auto-icon')).toBe(false)
    expect(element.classList.contains('light-icon')).toBe(true)
    expect(element.title).toBe('Bright')

    runtimeState.colorScheme = 'dark'
    await element.requestUpdate()
    await element.updateComplete

    expect(element.classList.contains('light-icon')).toBe(false)
    expect(element.classList.contains('dark-icon')).toBe(true)
    expect(element.title).toBe('Dim')
  })

  it('cycles preferred light mode through auto, preferred, and inverted states', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false } as MediaQueryList),
    )

    const element = new MarkeeColorSchemeManager()
    document.body.append(element)

    runtimeState.colorScheme = 'light'
    element.click()
    expect(colorSchemeSet).toHaveBeenLastCalledWith('auto')

    runtimeState.colorScheme = 'dark'
    element.click()
    expect(colorSchemeSet).toHaveBeenLastCalledWith('light')

    runtimeState.colorScheme = 'auto'
    element.click()
    expect(colorSchemeSet).toHaveBeenLastCalledWith('dark')
  })

  it('uses the dark preference branch and removes the click listener on disconnect', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true } as MediaQueryList),
    )

    const element = new MarkeeColorSchemeManager()
    document.body.append(element)

    runtimeState.colorScheme = 'dark'
    element.click()
    expect(colorSchemeSet).toHaveBeenLastCalledWith('auto')

    colorSchemeSet.mockClear()
    element.remove()
    runtimeState.colorScheme = 'auto'
    element.click()
    expect(colorSchemeSet).not.toHaveBeenCalled()
  })
})
