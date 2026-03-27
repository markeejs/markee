import Prism from 'prismjs'
import { loadLanguage } from '../resources/prism-languages.js'

export type PrismTheme =
  | 'oneLight'
  | 'oneDark'
  | 'default'
  | 'coy'
  | 'dark'
  | 'funky'
  | 'okaidia'
  | 'solarizedlight'
  | 'tomorrow'
  | 'twilight'

const themes = {
  // @ts-ignore
  default: () => import('../styles/prism-themes/one-light.css?raw'),
  // @ts-ignore
  oneLight: () => import('../styles/prism-themes/one-light.css?raw'),
  // @ts-ignore
  oneDark: () => import('../styles/prism-themes/one-dark.css?raw'),
  // @ts-ignore
  coy: () => import('prismjs/themes/prism-coy.css?raw'),
  // @ts-ignore
  dark: () => import('prismjs/themes/prism-dark.css?raw'),
  // @ts-ignore
  funky: () => import('prismjs/themes/prism-funky.css?raw'),
  // @ts-ignore
  okaidia: () => import('prismjs/themes/prism-okaidia.css?raw'),
  // @ts-ignore
  solarizedlight: () => import('prismjs/themes/prism-solarizedlight.css?raw'),
  // @ts-ignore
  tomorrow: () => import('prismjs/themes/prism-tomorrow.css?raw'),
  // @ts-ignore
  twilight: () => import('prismjs/themes/prism-twilight.css?raw'),
} as Record<PrismTheme, () => Promise<{ default: string }>>

const appliedThemes = {
  lightTheme: 'oneLight' as PrismTheme,
  darkTheme: 'oneDark' as PrismTheme,
}

export const getTheme = async (theme: PrismTheme) => {
  return (await themes[theme]?.())?.default as string
}
export const loadTheme = async (theme: PrismTheme) => {
  const css = await getTheme(theme)
  if (css) {
    const prismTheme =
      (document.getElementById('prism-theme') as HTMLStyleElement) ??
      document.createElement('style')
    prismTheme.id = 'prism-theme'
    prismTheme.innerHTML = `@layer markee {
        ${css}
        }`
    if (!document.getElementById('prism-theme')) {
      document.head.appendChild(prismTheme)
    }
  }
}

const syncTheme = () => {
  let selectedColorScheme = document.body.dataset.colorScheme ?? 'auto'
  if (selectedColorScheme === 'auto') {
    selectedColorScheme = window.matchMedia('(prefers-color-scheme: dark)')
      .matches
      ? 'dark'
      : 'light'
  }
  void loadTheme(
    selectedColorScheme === 'light'
      ? (prism?.lightTheme ?? 'oneLight')
      : (prism?.darkTheme ?? 'oneDark'),
  )
}

export const prism = {
  getTheme,
  loadTheme,
  set lightTheme(theme: PrismTheme) {
    appliedThemes.lightTheme = theme
    syncTheme()
  },
  set darkTheme(theme: PrismTheme) {
    appliedThemes.darkTheme = theme
    syncTheme()
  },
  get lightTheme() {
    return appliedThemes.lightTheme
  },
  get darkTheme() {
    return appliedThemes.darkTheme
  },
  async loadLanguage(lang: string) {
    return loadLanguage(lang).then(() => {
      window.dispatchEvent(new CustomEvent('markee:prism-language-loaded', {}))
    })
  },
}

syncTheme()

window.Prism = Prism
