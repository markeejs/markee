import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismExtensionState = vi.hoisted(() => ({
  prism: {},
  loadLanguage: vi.fn(async () => {}),
}))

vi.mock('prismjs', () => ({
  default: prismExtensionState.prism,
}))

vi.mock('../resources/prism-languages.js', () => ({
  loadLanguage: prismExtensionState.loadLanguage,
}))

vi.mock('../styles/prism-themes/one-light.css?raw', () => ({
  default: '.light-theme{}',
}))

vi.mock('../styles/prism-themes/one-dark.css?raw', () => ({
  default: '.dark-theme{}',
}))

vi.mock('prismjs/themes/prism-coy.css?raw', () => ({
  default: '.coy-theme{}',
}))
vi.mock('prismjs/themes/prism-dark.css?raw', () => ({
  default: '.dark-prism-theme{}',
}))
vi.mock('prismjs/themes/prism-funky.css?raw', () => ({
  default: '.funky-theme{}',
}))
vi.mock('prismjs/themes/prism-okaidia.css?raw', () => ({
  default: '.okaidia-theme{}',
}))
vi.mock('prismjs/themes/prism-solarizedlight.css?raw', () => ({
  default: '.solarizedlight-theme{}',
}))
vi.mock('prismjs/themes/prism-tomorrow.css?raw', () => ({
  default: '.tomorrow-theme{}',
}))
vi.mock('prismjs/themes/prism-twilight.css?raw', () => ({
  default: '.twilight-theme{}',
}))

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function importPrismExtensions() {
  vi.resetModules()
  return import('./prism.extensions.js')
}

describe('prism.extensions', () => {
  beforeEach(() => {
    prismExtensionState.loadLanguage.mockReset()
    prismExtensionState.loadLanguage.mockImplementation(async () => {})
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    delete document.body.dataset.colorScheme
    delete (window as Window & { Prism?: unknown }).Prism
    installMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('syncs the default light theme on import and exposes Prism globally', async () => {
    const module = await importPrismExtensions()
    await flush()

    const style = document.getElementById('prism-theme') as HTMLStyleElement
    expect(style).not.toBeNull()
    expect(style.innerHTML).toContain('.light-theme{}')
    expect((window as Window & { Prism?: unknown }).Prism).toBe(
      prismExtensionState.prism,
    )
    expect(module.prism.lightTheme).toBe('oneLight')
    expect(module.prism.darkTheme).toBe('oneDark')
  })

  it('switches themes through setters, reuses the style element, and ignores missing themes', async () => {
    document.body.dataset.colorScheme = 'dark'
    const module = await importPrismExtensions()
    await flush()

    const originalStyle = document.getElementById('prism-theme')
    expect((originalStyle as HTMLStyleElement).innerHTML).toContain(
      '.dark-theme{}',
    )

    document.body.dataset.colorScheme = 'light'
    module.prism.lightTheme = 'oneDark'
    await flush()
    expect((document.getElementById('prism-theme') as HTMLStyleElement).innerHTML)
      .toContain('.dark-theme{}')
    expect(document.querySelectorAll('#prism-theme')).toHaveLength(1)

    module.prism.darkTheme = 'oneLight'
    document.body.dataset.colorScheme = 'dark'
    await module.loadTheme('missing' as any)
    expect(document.querySelectorAll('#prism-theme')).toHaveLength(1)
    expect(await module.getTheme('missing' as any)).toBeUndefined()
  })

  it('loads every supported theme and uses syncTheme fallbacks when getters return undefined', async () => {
    const module = await importPrismExtensions()
    await flush()

    await expect(module.getTheme('default')).resolves.toBe('.light-theme{}')
    await expect(module.getTheme('oneLight')).resolves.toBe('.light-theme{}')
    await expect(module.getTheme('oneDark')).resolves.toBe('.dark-theme{}')
    await expect(module.getTheme('coy')).resolves.toBe('.coy-theme{}')
    await expect(module.getTheme('dark')).resolves.toBe('.dark-prism-theme{}')
    await expect(module.getTheme('funky')).resolves.toBe('.funky-theme{}')
    await expect(module.getTheme('okaidia')).resolves.toBe('.okaidia-theme{}')
    await expect(module.getTheme('solarizedlight')).resolves.toBe(
      '.solarizedlight-theme{}',
    )
    await expect(module.getTheme('tomorrow')).resolves.toBe('.tomorrow-theme{}')
    await expect(module.getTheme('twilight')).resolves.toBe('.twilight-theme{}')

    const lightThemeDescriptor = Object.getOwnPropertyDescriptor(
      module.prism,
      'lightTheme',
    )
    const darkThemeDescriptor = Object.getOwnPropertyDescriptor(
      module.prism,
      'darkTheme',
    )

    Object.defineProperty(module.prism, 'lightTheme', {
      configurable: true,
      get: () => undefined,
      set: lightThemeDescriptor?.set,
    })
    document.body.dataset.colorScheme = 'light'
    module.prism.darkTheme = 'oneDark'
    await flush()
    expect((document.getElementById('prism-theme') as HTMLStyleElement).innerHTML)
      .toContain('.light-theme{}')

    Object.defineProperty(module.prism, 'darkTheme', {
      configurable: true,
      get: () => undefined,
      set: darkThemeDescriptor?.set,
    })
    document.body.dataset.colorScheme = 'dark'
    module.prism.lightTheme = 'oneLight'
    await flush()
    expect((document.getElementById('prism-theme') as HTMLStyleElement).innerHTML)
      .toContain('.dark-theme{}')
  })

  it('uses system dark preference for auto mode and dispatches the language-loaded event', async () => {
    installMatchMedia(true)
    const listener = vi.fn()
    window.addEventListener('markee:prism-language-loaded', listener)

    const module = await importPrismExtensions()
    await flush()
    expect((document.getElementById('prism-theme') as HTMLStyleElement).innerHTML)
      .toContain('.dark-theme{}')

    await module.prism.loadLanguage('tsx')

    expect(prismExtensionState.loadLanguage).toHaveBeenCalledWith('tsx')
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('markee:prism-language-loaded', listener)
  })
})
