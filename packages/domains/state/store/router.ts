import { createRouter } from '@nanostores/router'
import { $navigation } from './metadata.js'

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

document.addEventListener('click', (event) => {
  const { files } = $navigation.get()
  const link = (event.target as HTMLElement)?.closest('a')
  const file =
    files[link?.dataset?.file as string] ||
    Object.values(files).find(
      (f) =>
        compareLink(f.link, link?.pathname as string) ||
        f.alias?.some((alias) => compareLink(alias, link?.pathname as string)),
    )

  if (
    link &&
    file &&
    event.button === 0 && // Left mouse button
    link.rel !== 'external' && // Not external link
    link.target !== '_blank' && // Not for new tab
    link.target !== '_self' && // Not manually disabled
    link.origin === location.origin && // Not external link
    !link.download && // Not download link
    !event.altKey && // Not download link by user
    !event.metaKey && // Not open in new tab by user
    !event.ctrlKey && // Not open in new tab by user
    !event.shiftKey && // Not open in new window by user
    !event.defaultPrevented // Click was not cancelled
  ) {
    // Prevent default if nothing changed (link to same page was clicked)
    if (link.pathname === location.pathname && link.href === location.href) {
      event.preventDefault()
    }

    // Prevent default and navigate if path changed
    if (
      link.pathname !== location.pathname ||
      link.search !== location.search
    ) {
      event.preventDefault()
      $router.open(link.href)
    }

    // Scroll into view on same hash click
    if (link.hash && link.pathname === location.pathname) {
      document.querySelector(link.hash)?.scrollIntoView()
    }
  }
})
