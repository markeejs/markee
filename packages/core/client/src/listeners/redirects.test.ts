import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectsState = vi.hoisted(() => ({
  compute: undefined as
    | undefined
    | ((router: any, config: any) => string | undefined),
  subscribe: undefined as undefined | ((redirect?: string) => void),
  replace: vi.fn(),
}))

vi.mock('nanostores', () => ({
  computed(
    _: unknown,
    compute: (router: any, config: any) => string | undefined,
  ) {
    redirectsState.compute = compute
    return {
      subscribe(callback: (redirect?: string) => void) {
        redirectsState.subscribe = callback
        return () => {}
      },
    }
  },
}))

vi.mock('@markee/state', () => ({
  state: {
    $router: {
      get: () => ({ navigate: { replace: redirectsState.replace } }),
    },
    $config: {},
  },
}))

describe('redirects listener', () => {
  beforeEach(() => {
    vi.resetModules()
    redirectsState.replace.mockClear()
    redirectsState.compute = undefined
    redirectsState.subscribe = undefined
  })

  it('normalizes slash variants when looking up redirects and navigates to the resolved target', async () => {
    await import('./redirects.js')

    const redirect = redirectsState.compute?.(
      { path: '/docs/start/' },
      { redirects: { 'docs/start': '/docs/intro' } },
    )

    expect(redirect).toBe('/docs/intro')

    redirectsState.subscribe?.('/docs/intro')
    expect(redirectsState.replace).toHaveBeenCalledWith('/docs/intro')
  })

  it('returns nothing when there is no matching redirect candidate', async () => {
    await import('./redirects.js')

    expect(
      redirectsState.compute?.(
        { path: '/missing' },
        { redirects: { other: '/target' } },
      ),
    ).toBeUndefined()
  })

  it('handles router paths without a leading slash, with and without a trailing slash', async () => {
    await import('./redirects.js')

    expect(
      redirectsState.compute?.(
        { path: 'docs/start/' },
        { redirects: { 'docs/start': '/docs/intro' } },
      ),
    ).toBe('/docs/intro')

    expect(
      redirectsState.compute?.(
        { path: 'docs/start' },
        { redirects: { 'docs/start': '/docs/intro' } },
      ),
    ).toBe('/docs/intro')
  })
})
