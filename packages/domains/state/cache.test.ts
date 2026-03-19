import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@markee/pipeline', () => ({
  clientPipeline: vi.fn(async (content: string, title: string, key: string) =>
    `html:${content}:${title ?? ''}:${key}`,
  ),
}))

import { clientPipeline } from '@markee/pipeline'

import { autoAppend, cache, clearCache } from './cache'
import { $configLoader, $navigationLoader } from './store/metadata'

beforeEach(() => {
  clearCache()
  $configLoader.set({ loading: false, data: null, error: null })
  $navigationLoader.set({
    loading: false,
    data: { files: {}, folders: {}, assets: {} },
    error: null,
  })
})

describe('cache', () => {
  it('returns the original content when no auto-append parts are configured', async () => {
    await expect(autoAppend('BASE')).resolves.toBe('BASE')
  })

  it('appends configured markdown parts to raw content', async () => {
    $configLoader.set({
      loading: false,
      data: { autoAppend: ['/one.md', '/two.md'] } as any,
      error: null,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          text: () => Promise.resolve(url === '/one.md' ? 'ONE' : 'TWO'),
        }),
      ),
    )

    await expect(autoAppend('BASE')).resolves.toBe('BASE\nONE\nTWO')
  })

  it('processes markdown and markdown layouts through clientPipeline', async () => {
    $configLoader.set({
      loading: false,
      data: { autoAppend: ['/append.md'] } as any,
      error: null,
    })
    $navigationLoader.set({
      loading: false,
      data: {
        files: {
          '/page.md': {
            link: '/page',
            layout: 'docs',
            frontMatter: { title: 'Page', excerpt: '' },
            readingTime: 0,
            payload: {},
          } as any,
        },
        folders: {},
        assets: {},
      },
      error: null,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          text: () =>
            Promise.resolve(
              {
                '/page.md': 'PAGE',
                '/append.md': 'APPEND',
                '/layout.md': 'LAYOUT',
              }[url] ?? '',
            ),
        }),
      ),
    )

    await expect(cache('/page.md', 'markdown')).resolves.toBe(
      'html:PAGE\nAPPEND:Page:/page.md',
    )
    await expect(cache('/layout.md', 'markdown-layout')).resolves.toBe(
      'html:LAYOUT::/layout.md',
    )

    expect(clientPipeline).toHaveBeenCalledWith('PAGE\nAPPEND', 'Page', '/page.md')
    expect(clientPipeline).toHaveBeenCalledWith('LAYOUT', undefined, '/layout.md')
  })

  it('parses json safely and caches the in-flight promise by url', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('{invalid'),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const first = cache('/data.json', 'json')
    const second = cache('/data.json', 'json')

    await expect(first).resolves.toEqual({})
    await expect(second).resolves.toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
  })

  it('returns raw html and falls back to null when loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn((url: string) => {
      if (url === '/page.html') {
        return Promise.resolve({
          text: () => Promise.resolve('<p>HTML</p>'),
        })
      }

      return Promise.reject(new Error('missing'))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(cache('/page.html', 'html')).resolves.toBe('<p>HTML</p>')
    clearCache()
    await expect(cache('/missing.html', 'html')).resolves.toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })
})
