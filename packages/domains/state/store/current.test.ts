import type { MarkdownFile } from '@markee/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../cache.js', () => ({
  cache: vi.fn(),
}))

import { cache } from '../cache.js'
import {
  $current,
  $currentFile,
  $currentLoader,
  $lock,
  preload,
} from './current.js'
import { $configLoader, $layoutsLoader, $navigationLoader } from './metadata.js'
import { $router } from './router.js'

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

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
  vi.mocked(cache).mockReset()
  $lock.set(true)
  $current.set({})
  $currentLoader.set(null)
  $configLoader.set({ loading: false, data: {} as any, error: null })
  $layoutsLoader.set({
    loading: false,
    data: { layouts: {} },
    error: null,
  })
  $navigationLoader.set({
    loading: false,
    data: { files: {}, folders: {}, assets: {} },
    error: null,
  })
  $router.open('/')
})

describe('$currentFile', () => {
  it('matches the current route by link and alias', () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide.md': markdownFile('/docs/guide', 'docs', {
            alias: ['/guide-alias'],
          }),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })

    $router.open('/guide-alias')
    expect($currentFile.get()?.key).toBe('guide.md')

    $router.open('/docs/guide')
    expect($currentFile.get()?.key).toBe('guide.md')
  })
})

describe('preload', () => {
  it('loads markdown content and all configured layout slots', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'docs/guide.md': markdownFile('/docs/guide'),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: {
        header: 'header.html',
        footer: 'footer.md',
        layouts: {
          docs: {
            top: 'top.html',
            bottom: 'bottom.md',
            left: 'left.html',
            right: 'right.md',
            main: 'main.md',
          },
        },
      },
      error: null,
    })
    vi.mocked(cache).mockImplementation(((url: string) =>
      Promise.resolve(url.toUpperCase())) as any)

    await expect(preload('docs/guide.md')).resolves.toEqual({
      key: 'docs/guide.md',
      file: $navigationLoader.get().data?.files['docs/guide.md'],
      content: 'DOCS/GUIDE.MD',
      header: 'HEADER.HTML',
      footer: 'FOOTER.MD',
      top: 'TOP.HTML',
      bottom: 'BOTTOM.MD',
      left: 'LEFT.HTML',
      right: 'RIGHT.MD',
      main: 'MAIN.MD',
    })
  })

  it('uses the correct file type for layout slots based on extensions', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'docs/guide.md': markdownFile('/docs/guide'),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: {
        header: 'header.md',
        footer: 'footer.html',
        layouts: {
          docs: {
            top: 'top.md',
            bottom: 'bottom.html',
            left: 'left.md',
            right: 'right.html',
            main: 'main.html',
          },
        },
      },
      error: null,
    })
    vi.mocked(cache).mockImplementation(((url: string) =>
      Promise.resolve(url.toUpperCase())) as any)

    await preload('docs/guide.md')

    expect(cache).toHaveBeenCalledWith('header.md', 'markdown-layout')
    expect(cache).toHaveBeenCalledWith('footer.html', 'html')
    expect(cache).toHaveBeenCalledWith('top.md', 'markdown-layout')
    expect(cache).toHaveBeenCalledWith('bottom.html', 'html')
    expect(cache).toHaveBeenCalledWith('left.md', 'markdown-layout')
    expect(cache).toHaveBeenCalledWith('right.html', 'html')
    expect(cache).toHaveBeenCalledWith('main.html', 'html')
  })

  it('falls back to empty layout metadata when no layout store data exists', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'docs/guide.md': markdownFile('/docs/guide'),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: null,
      error: null,
    })
    vi.mocked(cache).mockImplementation(((url: string) =>
      Promise.resolve(url.toUpperCase())) as any)

    await expect(preload('docs/guide.md')).resolves.toMatchObject({
      header: null,
      footer: null,
      top: null,
      bottom: null,
      left: null,
      right: null,
      main: '<markee-content></markee-content>',
    })
  })
})

describe('reload side effects', () => {
  it('loads the 404 shell when no current file is available', async () => {
    $navigationLoader.set({
      loading: false,
      data: { files: {}, folders: {}, assets: {} },
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: { layouts: {} },
      error: null,
    })

    $router.open('/missing')
    $lock.set(false)
    await flush()

    expect($currentLoader.get()).toEqual({
      key: '404',
      layout: '404',
      content: '',
    })
    expect($current.get().main).toBe('<markee-content></markee-content>')
  })

  it('does not reload while metadata is not ready', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide.md': markdownFile('/docs/guide'),
        },
        folders: {},
        assets: {},
      },
      error: null,
    })
    $layoutsLoader.set({
      loading: false,
      data: null,
      error: null,
    })

    $router.open('/docs/guide')
    $lock.set(false)
    await flush()

    expect($currentLoader.get()).toBeNull()
    $lock.set(true)
  })

  it('loads the current markdown file when unlocked and preserves a single root separator', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          'guide.md': markdownFile('/docs/guide', 'docs', {
            frontMatter: {
              excerpt: '',
              class: 'page',
            },
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
    vi.mocked(cache).mockImplementation(((url: string) =>
      Promise.resolve(`loaded:${url}`)) as any)

    $router.open('/docs/guide')
    $lock.set(false)
    await flush()

    expect(cache).toHaveBeenCalledWith('guide.md', 'markdown')
    expect($currentLoader.get()).toEqual({
      key: 'guide.md',
      layout: 'docs',
      className: 'page',
      content: 'loaded:guide.md',
    })
    expect($current.get().main).toBe('<markee-content></markee-content>')
    expect(document.body.dataset.loading).toBe('false')
  })

  it('uses normalized non-trailing roots when preloading the current file', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          '/guide.md': markdownFile('/docs/guide', 'docs', {
            root: '/prefix',
            frontMatter: {
              excerpt: '',
            },
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
    vi.mocked(cache).mockImplementation(((url: string) =>
      Promise.resolve(`loaded:${url}`)) as any)

    $router.open('/docs/guide')
    $lock.set(false)
    await flush()

    expect(cache).toHaveBeenCalledWith('/prefix/guide.md', 'markdown')
    $lock.set(true)
  })

  it('normalizes trailing root separators and null content when reloading', async () => {
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          '/guide.md': markdownFile('/docs/guide', 'docs', {
            root: '/prefix/',
            frontMatter: {
              excerpt: '',
            },
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
    vi.mocked(cache).mockImplementation(((url: string, type: string) =>
      Promise.resolve(type === 'markdown' ? null : `loaded:${url}`)) as any)

    $router.open('/docs/guide')
    $lock.set(false)
    await flush()

    expect(cache).toHaveBeenCalledWith('/prefix/guide.md', 'markdown')
    expect($currentLoader.get()?.content).toBe('')
    $lock.set(true)
  })

  it('rejects preload calls when metadata for the file is missing', async () => {
    $navigationLoader.set({
      loading: false,
      data: null,
      error: null,
    })
    await expect(preload('missing.md')).rejects.toThrow()
  })
})
