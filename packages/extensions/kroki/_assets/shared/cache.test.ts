import { describe, expect, it, vi } from 'vitest'

type FakeRequest<T> = {
  result?: T
  onsuccess?: () => void
  onerror?: (err: unknown) => void
}

function createRequest<T>() {
  return {} as FakeRequest<T>
}

async function importCache({
  withExisting = true,
  readError = null,
  writeError = null,
  openError = null,
}: {
  withExisting?: boolean
  readError?: unknown
  writeError?: unknown
  openError?: unknown
} = {}) {
  vi.resetModules()

  const get = vi.fn(() => {
    const readRequest = createRequest<{ value: string }>()
    queueMicrotask(() => {
      if (readError) {
        readRequest.onerror?.(readError)
        return
      }

      readRequest.result = withExisting ? { value: 'cached' } : undefined
      readRequest.onsuccess?.()
    })
    return readRequest
  })
  const add = vi.fn(() => {
    const writeRequest = createRequest<void>()
    queueMicrotask(() => {
      if (writeError) {
        writeRequest.onerror?.(writeError)
        return
      }

      writeRequest.onsuccess?.()
    })
    return writeRequest
  })
  const objectStore = vi.fn(() => ({ get, add }))
  const transaction = vi.fn(() => ({ objectStore }))
  const openRequest: any = {
    result: {
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      createObjectStore: vi.fn(),
      transaction,
    },
  }

  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
      queueMicrotask(() => {
        if (openError) {
          openRequest.onerror?.(openError)
          return
        }
        openRequest.onupgradeneeded?.()
        openRequest.onsuccess?.()
      })
      return openRequest
    }),
  })

  return {
    ...(await import('./cache.mjs')),
    mocks: { get, add, objectStore, transaction },
  }
}

describe('@markee/kroki cache', () => {
  it('reads and writes cache entries through indexeddb', async () => {
    const { readCache, writeCache, valueCache, mocks } = await importCache()

    await expect(readCache('diagram')).resolves.toBe('cached')
    await expect(
      writeCache('diagram', '<svg>ok</svg>'),
    ).resolves.toBeUndefined()

    valueCache.set('diagram', 'inline')
    expect(valueCache.get('diagram')).toBe('inline')
    expect(mocks.get).toHaveBeenCalledWith('diagram')
    expect(mocks.add).toHaveBeenCalledWith({
      content: 'diagram',
      value: '<svg>ok</svg>',
    })
  })

  it('rejects when reads miss and when writes fail', async () => {
    const miss = await importCache({ withExisting: false })
    await expect(miss.readCache('missing')).rejects.toBeUndefined()

    const readFailure = await importCache({
      readError: new Error('read failed'),
    })
    await expect(readFailure.readCache('diagram')).rejects.toThrow(
      'read failed',
    )

    const failure = await importCache({ writeError: new Error('boom') })
    await expect(
      failure.writeCache('diagram', '<svg>nope</svg>'),
    ).rejects.toThrow('boom')
  })

  it('rejects when the indexeddb connection itself fails', async () => {
    const failure = await importCache({ openError: new Error('open failed') })

    await expect(failure.readCache('diagram')).rejects.toThrow('open failed')
  })
})
