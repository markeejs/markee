import { state } from '@markee/runtime'
import { extend } from '@markee/runtime'

// Sync theme to Body dataset
state.$config.subscribe(
  (config) => (document.body.dataset.theme = config?.theme ?? 'default'),
)

// Sync path to Body dataset
state.$currentFile.subscribe((file) => {
  document.body.dataset.path = file?.link
})

// Sync loading state and layout to Body dataset, and class to Body attributes
state.$currentLoader.subscribe(({ loading: _loading, data }) => {
  const loading = _loading || !data
  const { layout, className } = data ?? {}

  if (loading) {
    document.body.dataset.loading = 'true'
  } else {
    document.body.dataset.loading = 'false'
    document.body.dataset.layout = layout

    if (className) {
      document.body.setAttribute('class', className)
    } else {
      document.body.removeAttribute('class')
    }
  }
})

// Sync theme to body attributes
state.$colorScheme.subscribe((colorScheme) => {
  let selectedColorScheme = colorScheme
  if (colorScheme === 'auto') {
    selectedColorScheme = window.matchMedia('(prefers-color-scheme: dark)')
      .matches
      ? 'dark'
      : 'light'
  }
  document.body.setAttribute('data-color-scheme', colorScheme)
  extend.prism?.loadTheme(
    selectedColorScheme === 'light'
      ? (extend.prism?.lightTheme ?? 'oneLight')
      : (extend.prism?.darkTheme ?? 'oneDark'),
  )
})

// Sync current file title to HTML document title
const siteTitle = document.title
state
  .combine(['$config', '$currentFile'])
  .subscribe(([config, currentFile]) => {
    document.title = (config?.titleTemplate || '{site}{if:page: - }{page}')
      .replace('{site}', siteTitle)
      .replace('{page}', currentFile?.frontMatter?.title?.trim() || '')
      .replace(
        /\{if:page:(.*?)}/g,
        currentFile?.frontMatter?.title?.trim() ? '$1' : '',
      )
  })
