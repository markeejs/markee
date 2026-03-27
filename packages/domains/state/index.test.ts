import type { MarkdownFile } from '@markee/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cache.js', () => ({
  cache: vi.fn(),
  clearCache: vi.fn(),
}))

import { state } from '@markee/state'
import { $currentLoader, $lock } from './store/current.js'
import {
  $configLoader,
  $layoutsLoader,
  $navigationLoader,
} from './store/metadata.js'
import { $router } from './store/router.js'

function markdownFile(
  link: string,
  layout = 'docs',
  extra: Partial<MarkdownFile> = {},
) {
  return {
    link,
    layout,
    frontMatter: {
      excerpt: '',
      ...extra.frontMatter,
    },
    readingTime: 0,
    payload: {},
    ...extra,
  } as MarkdownFile
}

beforeEach(() => {
  $lock.set(true)
  $currentLoader.set(null)
  state.$colorScheme.set('auto')
  $configLoader.set({ loading: false, data: {} as any, error: null })
  $layoutsLoader.set({ loading: false, data: { layouts: {} }, error: null })
  $navigationLoader.set({
    loading: false,
    data: { files: {}, folders: {}, assets: {} },
    error: null,
  })
  $router.open('/')
})

describe('state', () => {
  it('wraps router navigation with open and replace helpers', () => {
    const open = vi.spyOn($router, 'open')

    state.$router.get().navigate.open('/docs/guide')
    state.$router.get().navigate.replace('/docs/guide?page=2')

    expect(open).toHaveBeenNthCalledWith(1, '/docs/guide')
    expect(open).toHaveBeenNthCalledWith(2, '/docs/guide?page=2', true)
  })

  it('reads payloads from the current file and the active layout slots', () => {
    $configLoader.set({
      loading: false,
      data: {
        plugins: {
          demo: { from: 'config' },
        },
      } as any,
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: {
        layouts: {
          docs: {
            main: 'layouts/main.md',
          },
        },
      },
      error: null,
    })
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide.md': markdownFile('/guide', 'docs', {
            frontMatter: {
              excerpt: '',
              plugins: {
                // @ts-ignore - minimum test shim
                demo: { from: 'frontmatter' },
              },
            },
            payload: {
              widget: {
                demo: { from: 'content' },
              },
            },
          }),
          'layouts/main.md': markdownFile('/layouts/main', '', {
            payload: {
              'layouts/main.md': {
                demo: { from: 'layout' },
              },
            },
          }),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $router.open('/guide')

    const contentWrapper = document.createElement('markee-content')
    const contentElement = document.createElement('div')
    contentElement.id = 'widget'
    contentWrapper.append(contentElement)
    document.body.append(contentWrapper)

    const section = document.createElement('section')
    section.id = 'markee-section-main'
    const layoutElement = document.createElement('div')
    section.append(layoutElement)
    document.body.append(section)

    expect(
      state.$payload.get().for({ plugin: 'demo', element: contentElement }),
    ).toEqual({
      from: 'content',
    })
    expect(
      state.$payload.get().for({ plugin: 'demo', element: layoutElement }),
    ).toEqual({
      from: 'layout',
    })
    expect(state.$pluginConfig.get().for('demo')).toEqual({
      from: 'frontmatter',
    })
  })

  it('exposes current loader state, config wrappers, and store combinators', () => {
    $configLoader.set({
      loading: false,
      data: { title: 'Docs' },
      error: null,
    })
    $currentLoader.set({
      key: 'guide.md',
      layout: 'docs',
      content: '<p>Guide</p>',
    })
    state.$colorScheme.set('dark')

    expect(state.$config.get()).toEqual({ title: 'Docs' })
    expect(state.$currentLoader.get()).toEqual({
      loading: false,
      data: {
        key: 'guide.md',
        layout: 'docs',
        content: '<p>Guide</p>',
      },
      error: null,
    })

    const combined = state.combine(['$colorScheme', '$config'])
    const computed = state.compute(
      ['$colorScheme', '$config'],
      (scheme, config) => `${scheme}:${config?.title}`,
    )

    expect(combined.get()).toEqual(['dark', { title: 'Docs' }])
    expect(computed.get()).toBe('dark:Docs')

    $currentLoader.set(null)
    expect(state.$currentLoader.get()).toEqual({
      loading: true,
      data: null,
      error: null,
    })
  })

  it('falls back to config plugin settings and empty navigation data', () => {
    $configLoader.set({
      loading: false,
      data: {
        plugins: {
          demo: { from: 'config' },
        },
      } as any,
      error: null,
    })
    $navigationLoader.set({
      loading: false,
      data: null,
      error: null,
    })

    expect(state.$navigation.get().files).toEqual({})
    expect(state.$pluginConfig.get().for('demo')).toEqual({ from: 'config' })
  })

  it('returns null payloads for unknown sections and missing element payloads', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide.md': markdownFile('/guide', 'docs', {
            payload: {},
          }),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: { layouts: { docs: {} } },
      error: null,
    })
    $router.open('/guide')

    const loose = document.createElement('div')
    loose.id = 'missing'
    document.body.append(loose)

    const section = document.createElement('section')
    section.id = 'markee-section-unknown'
    const inner = document.createElement('div')
    section.append(inner)
    document.body.append(section)

    expect(
      state.$payload.get().for({ plugin: 'demo', element: loose }),
    ).toBeNull()
    expect(
      state.$payload.get().for({ plugin: 'demo', element: inner }),
    ).toBeNull()
  })

  it('uses the 404 layout payload slots when no current file is selected', () => {
    $layoutsLoader.set({
      loading: false,
      data: {
        header: 'layouts/header.md',
        layouts: {
          '404': {
            top: 'layouts/top.md',
          },
        },
      },
      error: null,
    })
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'layouts/header.md': markdownFile('/layouts/header', '', {
            payload: {
              'layouts/header.md': {
                demo: { from: 'header-404' },
              },
            },
          }),
          'layouts/top.md': markdownFile('/layouts/top', '', {
            payload: {
              'layouts/top.md': {
                demo: { from: 'top-404' },
              },
            },
          }),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $router.open('/missing')

    const header = document.createElement('header')
    header.id = 'markee-header'
    const top = document.createElement('section')
    top.id = 'markee-section-top'
    document.body.append(header, top)

    expect(
      state.$payload.get().for({ plugin: 'demo', element: header }),
    ).toEqual({
      from: 'header-404',
    })
    expect(state.$payload.get().for({ plugin: 'demo', element: top })).toEqual({
      from: 'top-404',
    })
  })
})
