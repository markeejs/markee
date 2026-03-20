import { state } from '@markee/state'

function findVersionRoot(link: string, folders: Record<string, PagesFile>) {
  const path = link.split('/').slice(0, -1)
  while (path.length) {
    if (folders[path.join('/')]?.version) {
      return folders[path.join('/')]
    }
    path.pop()
  }
  return null
}

const observer = new MutationObserver(() => {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*=".md"]')
  links.forEach((link) => {
    if (link.host !== window.location.host) return

    let key = link.pathname
    const { files, folders } = state.$navigation.get()

    if (link.getAttribute('version') === 'latest') {
      const root = findVersionRoot(key, folders)
      if (root?.version?.folder) {
        const versions = root.versions!
        const targetVersion = versions.find(({ key: k }) => key.startsWith(k))
        const latestVersion = versions[0]
        key = key.replace(targetVersion!.key, latestVersion.key)
      } else if (root?.versions?.length) {
        key = root.versions[0].key
      }
    }

    const file = files[key]

    const url = new URL(link.href)
    if (file) {
      url.pathname = file.link
    } else {
      console.error('Found broken link:', key)
      url.pathname = ''
    }

    link.setAttribute('data-file', key)
    link.setAttribute(
      'href',
      url.toString().slice(window.location.origin.length),
    )
  })
})
observer.observe(document.body, { childList: true, subtree: true })
