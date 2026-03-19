import { createRouter } from '@nanostores/router'
import { $navigation } from './metadata.js'

// @ts-ignore
const isTestEnv = !!import.meta.env.VITEST

export const $router = createRouter(
  {
    article: /\/(.*)/,
  },
  {
    links: false,
  },
)

export function compareLink(link: string, path: string) {
  if (!link || !path) return false

  if (link.endsWith('/')) link = link.slice(0, -1)
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (link.startsWith('/')) link = link.slice(1)
  if (path.startsWith('/')) path = path.slice(1)

  return link === decodeURIComponent(path)
}

function findInternalNavigationFile(link: HTMLAnchorElement | null) {
  const { files } = $navigation.get()

  return (
    files[link?.dataset?.file as string] ||
    Object.values(files).find(
      (f) =>
        compareLink(f.link, link?.pathname as string) ||
        f.alias?.some((alias) => compareLink(alias, link?.pathname as string)),
    )
  )
}

export function handleRouterNavigationClick(event: MouseEvent) {
  const link = (event.target as HTMLElement | null)?.closest?.(
    'a',
  ) as HTMLAnchorElement | null
  const file = findInternalNavigationFile(link)

  if (!link || !file) return
  if (event.button !== 0) return
  if (link.rel === 'external') return
  if (link.target === '_blank') return
  if (link.target === '_self') return
  if (link.origin !== location.origin) return
  if (link.download) return
  if (event.altKey) return
  if (event.metaKey) return
  if (event.ctrlKey) return
  if (event.shiftKey) return
  if (event.defaultPrevented) return

  if (link.pathname === location.pathname && link.href === location.href) {
    event.preventDefault()
  }

  if (link.pathname !== location.pathname || link.search !== location.search) {
    event.preventDefault()
    $router.open(link.href)
  }

  if (link.hash && link.pathname === location.pathname) {
    document.querySelector(link.hash)?.scrollIntoView()
  }
}

export function installRouterNavigationListener() {
  document.addEventListener(
    'click',
    handleRouterNavigationClick as EventListener,
  )
}

/* v8 ignore start */
if (!isTestEnv) {
  installRouterNavigationListener()
}
/* v8 ignore stop */
