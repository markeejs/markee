import { beforeEach, describe, expect, it, vi } from 'vitest'
import { map } from 'nanostores'

vi.mock('../cache.js', () => ({
  cache: vi.fn(),
}))

import { cache } from '../cache.js'
import {
  $configLoader,
  $layoutsLoader,
  $metadataReady,
  $navigation,
  $navigationLoader,
  $searchLoader,
  installMetadataAutoRefresh,
  queueMetadataRefresh,
  revalidateMetadata,
  scheduleMetadataRevalidation,
} from './metadata.js'

const cacheMock = vi.mocked(cache)

beforeEach(() => {
  cacheMock.mockReset()
  $configLoader.set({ loading: true, data: null, error: null })
  $layoutsLoader.set({ loading: true, data: null, error: null })
  $navigationLoader.set({ loading: true, data: null, error: null })
  $searchLoader.set({ loading: true, data: null, error: null })
})

describe('metadata stores', () => {
  it('reuses the in-flight refresh promise and stores loaded data', async () => {
    let resolve!: (value: unknown) => void
    const pending = new Promise((r) => {
      resolve = r
    })
    cacheMock.mockReturnValueOnce(pending as Promise<any>)

    const first = $configLoader.refresh()
    const second = $configLoader.refresh()

    expect(first).toBe(second)
    expect($configLoader.get().loading).toBe(true)

    resolve({ siteName: 'Docs' })
    await first

    expect(cacheMock).toHaveBeenCalledWith('/_markee/config.json', 'json')
    expect($configLoader.get()).toEqual({
      loading: false,
      data: { siteName: 'Docs' },
      error: null,
    })
  })

  it('merges navigation split files and filters missing split references', async () => {
    cacheMock.mockImplementation((url: string) => {
      if (url === '/_markee/navigation.json') {
        return Promise.resolve({
          splits: ['fr', 'de'],
          files: {
            'guide.md': { link: '/guide' },
          },
          folders: {
            docs: {
              navigation: [
                { key: 'guide.md', split: true },
                { key: 'missing.md', split: true },
                { key: 'plain.md' },
              ],
              excluded: [
                { key: 'guide.md', split: true },
                { key: 'missing.md', split: true },
              ],
              versions: [
                { key: 'guide.md', split: true },
                { key: 'missing.md', split: true },
              ],
            },
          },
        })
      }

      if (url === 'fr/_markee/navigation.json') {
        return Promise.resolve({
          files: {
            'plain.md': { link: '/plain' },
          },
          folders: {},
        })
      }

      return Promise.reject(new Error('missing split'))
    })

    await $navigationLoader.refresh()

    expect($navigation.get().files).toMatchObject({
      'guide.md': { link: '/guide' },
      'plain.md': { link: '/plain' },
    })
    expect($navigationLoader.get().data?.folders.docs.navigation).toEqual([
      { key: 'guide.md', split: true },
      { key: 'plain.md' },
    ])
    expect($navigationLoader.get().data?.folders.docs.excluded).toEqual([
      { key: 'guide.md', split: true },
    ])
    expect($navigationLoader.get().data?.folders.docs.versions).toEqual([
      { key: 'guide.md', split: true },
    ])
  })

  it('merges search split shards and drops the split marker', async () => {
    cacheMock.mockImplementation((url: string) => {
      if (url === '/_markee/search.json') {
        return Promise.resolve({
          'guide.md': { intro: { l: 'Intro', c: ['Alpha'] } },
          _splits: ['fr'],
        })
      }

      return Promise.resolve({
        'other.md': { intro: { l: 'Other', c: ['Beta'] } },
      })
    })

    await $searchLoader.refresh()

    expect($searchLoader.get()).toEqual({
      loading: false,
      data: {
        'guide.md': { intro: { l: 'Intro', c: ['Alpha'] } },
        'other.md': { intro: { l: 'Other', c: ['Beta'] } },
      },
      error: null,
    })
  })

  it('stores refresh errors and computes metadata readiness from the loader data', async () => {
    const error = new Error('boom')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    cacheMock.mockRejectedValueOnce(error)

    await $layoutsLoader.refresh()

    expect($layoutsLoader.get().error).toBe(error)
    expect($layoutsLoader.get().loading).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(error)

    $configLoader.set({ loading: false, data: { siteName: 'Docs' } as any, error: null })
    $navigationLoader.set({
      loading: false,
      data: { files: {}, folders: {}, assets: {} },
      error: null,
    })

    expect($metadataReady.get()).toBe(false)

    $layoutsLoader.set({
      loading: false,
      data: { layouts: {} },
      error: null,
    })

    expect($metadataReady.get()).toBe(true)
  })

  it('revalidates every metadata loader', async () => {
    const configRefresh = vi
      .spyOn($configLoader, 'refresh')
      .mockResolvedValue(undefined)
    const searchRefresh = vi
      .spyOn($searchLoader, 'refresh')
      .mockResolvedValue(undefined)
    const navigationRefresh = vi
      .spyOn($navigationLoader, 'refresh')
      .mockResolvedValue(undefined)
    const layoutsRefresh = vi
      .spyOn($layoutsLoader, 'refresh')
      .mockResolvedValue(undefined)

    await revalidateMetadata()

    expect(configRefresh).toHaveBeenCalledOnce()
    expect(searchRefresh).toHaveBeenCalledOnce()
    expect(navigationRefresh).toHaveBeenCalledOnce()
    expect(layoutsRefresh).toHaveBeenCalledOnce()
  })

  it('queues refresh helpers through requestAnimationFrame', () => {
    const raf = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }) as typeof requestAnimationFrame)
    const refresh = vi.fn()
    vi.spyOn($configLoader, 'refresh').mockResolvedValue(undefined)
    vi.spyOn($searchLoader, 'refresh').mockResolvedValue(undefined)
    vi.spyOn($navigationLoader, 'refresh').mockResolvedValue(undefined)
    vi.spyOn($layoutsLoader, 'refresh').mockResolvedValue(undefined)
    const tempStore = map({ value: true })

    queueMetadataRefresh(refresh)
    installMetadataAutoRefresh(tempStore, refresh)
    tempStore.listen(() => {})
    scheduleMetadataRevalidation()

    expect(raf).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })
})
