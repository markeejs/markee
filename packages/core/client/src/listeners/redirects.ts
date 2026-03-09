import { computed } from 'nanostores'
import { state } from '@markee/state'

computed([state.$router, state.$config], (router, config) => {
  if (config?.redirects && router?.path) {
    const noSlash = router.path.endsWith('/')
      ? router.path.startsWith('/')
        ? router.path.slice(1, -1)
        : router.path.slice(0, -1)
      : router.path.startsWith('/')
        ? router.path.slice(1)
        : router.path.slice(0)
    const withTrailingSlash = `${noSlash}/`
    const withLeadingSlash = `/${noSlash}`
    const withBothSlash = `/${noSlash}/`

    const candidate = [
      noSlash,
      withTrailingSlash,
      withLeadingSlash,
      withBothSlash,
    ].find((path) => !!config?.redirects?.[path])

    if (candidate) {
      return config?.redirects?.[candidate]
    }
  }
}).subscribe((redirect) => {
  if (redirect) state.$router.get().navigate.replace(redirect)
})
