import { atom, computed, onNotify } from 'nanostores'
import { cache } from '../cache.js'
import { $router, compareLink } from './router.js'
import {
  $layoutsLoader,
  $metadataReady,
  $navigationLoader,
} from './metadata.js'

export const $lock = atom(true)

export const $current = atom<{
  key?: string
  file?: MarkdownFile
  header?: string | null
  footer?: string | null
  left?: string | null
  right?: string | null
  top?: string | null
  bottom?: string | null
  main?: string | null
  content?: string | null
}>({})

export const $currentFile = computed(
  [$router, $navigationLoader],
  (router, navigationStore) => {
    const path = router?.path || '/'
    const navigation = navigationStore?.data || { folders: {}, files: {} }
    const file = Object.entries(navigation.files).find(
      ([, info]) =>
        compareLink(info.link, path) ||
        info.alias?.some((link) => compareLink(link, path)),
    )

    if (!file) return null

    return {
      key: file[0],
      ...file[1],
    }
  },
)

export const $currentLoader = atom<null | {
  key: string
  layout: string
  className?: string
  content: string
}>(null)

const nullPromise = Promise.resolve(null)
const markeeContentPromise = Promise.resolve(
  '<markee-content></markee-content>',
)

export async function preload(file: string) {
  const navigation = $navigationLoader.get().data ?? {
    files: {},
    folders: {},
    assets: {},
  }

  const contentPromise = cache(file, 'markdown')
  const layout = await loadLayout(navigation.files[file].layout)

  return {
    key: file,
    file: navigation.files[file],
    content: await contentPromise,
    ...layout,
  }
}

async function loadLayout(layout: string) {
  const layouts = $layoutsLoader.get().data ?? { layouts: {} }

  const headerPromise = layouts.header
    ? cache(
        layouts.header,
        layouts.header.endsWith('.md') ? 'markdown-layout' : 'html',
      )
    : nullPromise
  const footerPromise = layouts.footer
    ? cache(
        layouts.footer,
        layouts.footer.endsWith('.md') ? 'markdown-layout' : 'html',
      )
    : nullPromise
  const topPromise = layouts.layouts[layout]?.top
    ? cache(
        layouts.layouts[layout]?.top,
        layouts.layouts[layout]?.top.endsWith('.md')
          ? 'markdown-layout'
          : 'html',
      )
    : nullPromise
  const bottomPromise = layouts.layouts[layout]?.bottom
    ? cache(
        layouts.layouts[layout]?.bottom,
        layouts.layouts[layout]?.bottom.endsWith('.md')
          ? 'markdown-layout'
          : 'html',
      )
    : nullPromise
  const leftPromise = layouts.layouts[layout]?.left
    ? cache(
        layouts.layouts[layout]?.left,
        layouts.layouts[layout]?.left.endsWith('.md')
          ? 'markdown-layout'
          : 'html',
      )
    : nullPromise
  const rightPromise = layouts.layouts[layout]?.right
    ? cache(
        layouts.layouts[layout]?.right,
        layouts.layouts[layout]?.right.endsWith('.md')
          ? 'markdown-layout'
          : 'html',
      )
    : nullPromise
  const mainPromise = layouts.layouts[layout]?.main
    ? cache(
        layouts.layouts[layout]?.main,
        layouts.layouts[layout]?.main.endsWith('.md')
          ? 'markdown-layout'
          : 'html',
      )
    : markeeContentPromise

  return {
    header: await headerPromise,
    footer: await footerPromise,
    top: await topPromise,
    bottom: await bottomPromise,
    left: await leftPromise,
    right: await rightPromise,
    main: await mainPromise,
  }
}

let last = ''
onNotify($currentFile, () => {
  if (last === $currentFile.get()?.key) return
  last = $currentFile.get()?.key ?? ''
  reload()
})
onNotify($metadataReady, reload)
onNotify($navigationLoader, () => !$navigationLoader.get().loading && reload())
onNotify($lock, () => !$lock.get() && reload())

function root(file: MarkdownFile) {
  if (file.root)
    return file.root.endsWith('/') ? file.root.slice(0, -1) : file.root
  return ''
}

function reload() {
  const currentFile = $currentFile.get()
  const metadataReady = $metadataReady.get()

  if ($lock.get()) return
  if (!metadataReady) return
  if (!currentFile) {
    loadLayout('404').then(async (layout) => {
      $current.set(layout)
      $currentLoader.set({
        key: '404',
        layout: '404',
        content: '',
      })
    })
    return
  }

  document.body.dataset.loading = 'true'
  preload(root(currentFile) + currentFile.key)
    .then((file) => {
      $current.set(file)
      $currentLoader.set({
        key: currentFile.key,
        layout: currentFile.layout,
        className: currentFile.frontMatter?.class,
        content: file.content ?? '',
      })
    })
    .finally(() => {
      document.body.dataset.loading = 'false'
    })
}
