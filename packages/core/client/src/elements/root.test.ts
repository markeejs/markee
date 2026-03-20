import { beforeEach, describe, expect, it, vi } from 'vitest'

const rootState = vi.hoisted(() => ({
  development: true,
  current: {
    header: '',
    footer: '',
    left: '',
    right: '',
    top: '',
    main: '',
    bottom: '',
  },
  metadataReady: false,
  navigation: { files: {} as Record<string, unknown> },
  lockSet: vi.fn(),
}))

vi.mock('@markee/runtime', async () => {
  const actual = await import('../../../runtime/custom-elements.js')
  return {
    ...actual,
    get development() {
      return rootState.development
    },
  }
})

vi.mock('@markee/state', () => ({}))
vi.mock('@markee/elements', () => ({}))

vi.mock('@markee/state/store/current.js', () => ({
  $current: {
    get: () => rootState.current,
    subscribe() {
      return () => {}
    },
  },
  $lock: {
    set: rootState.lockSet,
  },
}))

vi.mock('@markee/state/store/metadata.js', () => ({
  $metadataReady: {
    get: () => rootState.metadataReady,
    subscribe() {
      return () => {}
    },
  },
  $navigation: {
    get: () => rootState.navigation,
  },
}))

vi.mock('../listeners/metadata.js', () => ({}))
vi.mock('../listeners/preload.js', () => ({}))
vi.mock('../listeners/redirects.js', () => ({}))
vi.mock('../listeners/glightbox.js', () => ({}))
vi.mock('../listeners/anchors.js', () => ({}))
vi.mock('../listeners/code-fences.js', () => ({}))
vi.mock('./no-files.js', () => ({}))
vi.mock('./initial-loading.js', () => ({}))
vi.mock('./draft-warning.js', () => ({}))
vi.mock('@markee/pipeline/plugins/styles', () => ({}))

describe('markee-root', () => {
  beforeEach(() => {
    vi.resetModules()
    rootState.development = true
    rootState.current = {
      header: '',
      footer: '',
      left: '',
      right: '',
      top: '',
      main: '',
      bottom: '',
    }
    rootState.metadataReady = false
    rootState.navigation = { files: {} }
    rootState.lockSet.mockClear()
    document.body.innerHTML = ''
  })

  it('locks rendering off and shows the initial loading state in development until metadata is ready', async () => {
    await import('./root.js')

    expect(rootState.lockSet).toHaveBeenCalledWith(false)
    expect(document.body.innerHTML).toContain('markee-root')

    const root = document.getElementById('root') as HTMLElement & {
      updateComplete?: Promise<unknown>
    }
    await root.updateComplete

    expect(root.querySelector('markee-initial-loading')).not.toBeNull()
  })

  it('shows the no-files state when metadata is ready but only asset files exist', async () => {
    rootState.metadataReady = true
    rootState.navigation = {
      files: {
        '/_assets/logo.svg': {},
      },
    }

    await import('./root.js')

    const root = document.getElementById('root') as HTMLElement & {
      updateComplete?: Promise<unknown>
    }
    await root.updateComplete

    expect(root.querySelector('markee-no-files')).not.toBeNull()
  })

  it('renders the configured content sections when page data is available', async () => {
    rootState.development = false
    rootState.metadataReady = true
    rootState.navigation = {
      files: {
        '/docs/intro.md': {},
      },
    }
    rootState.current = {
      header: '<span>Header</span>',
      footer: '<span>Footer</span>',
      left: '<span>Left</span>',
      right: '<span>Right</span>',
      top: '<span>Top</span>',
      main: '<p>Main</p>',
      bottom: '<span>Bottom</span>',
    }

    await import('./root.js')

    const root = document.getElementById('root') as HTMLElement & {
      updateComplete?: Promise<unknown>
    }
    await root.updateComplete

    expect(root.querySelector('#markee-header')?.textContent).toContain('Header')
    expect(root.querySelector('#markee-section-top')?.textContent).toContain('Top')
    expect(root.querySelector('#markee-section-left')?.textContent).toContain('Left')
    expect(root.querySelector('#markee-section-main')?.textContent).toContain('Main')
    expect(root.querySelector('markee-draft-warning')).not.toBeNull()
    expect(root.querySelector('#markee-section-right')?.textContent).toContain(
      'Right',
    )
    expect(root.querySelector('#markee-section-bottom')?.textContent).toContain(
      'Bottom',
    )
    expect(root.querySelector('#markee-footer')?.textContent).toContain('Footer')
  })
})
