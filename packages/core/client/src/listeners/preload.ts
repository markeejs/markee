import { state } from '@markee/state'
import { compareLink } from '@markee/elements/utils/compare-link.js'
import { preload, root } from '@markee/state/store/current.js'

document.addEventListener('mousemove', (e) => {
  let link = (e.target as HTMLElement)?.closest('a')

  if (link && link.href) {
    const { host, pathname } = new URL(link.href)

    if (host === window.location.host) {
      const { files } = state.$navigation.get()
      const candidate = files[link.dataset.file as string]
        ? [link.dataset.file as string]
        : Object.entries(files).find(
            ([, info]) =>
              compareLink(info.link, pathname) ??
              info.alias?.some((alias) => compareLink(alias, pathname)),
          )

      if (candidate) {
        const key = candidate[0]
        const file = files[key]
        void preload(root(file) + key, key)
      }
    }
  }
})
