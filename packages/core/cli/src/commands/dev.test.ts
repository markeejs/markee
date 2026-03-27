import os from 'node:os'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
let ConfigCache: typeof import('../cache/config-cache.js').ConfigCache

type MockedFn = ReturnType<typeof vi.fn>

async function importCommandDev({
  rootDir,
  clientDir,
  pathExists = vi.fn(),
  hasBuildTimeExtensions = vi.fn(() => false),
  getExtensionFile = vi.fn(),
  loadFiles = vi.fn(),
  loadFolders = vi.fn(),
  loadMetadata = vi.fn(),
  reportBrokenLinks = vi.fn(),
  markdownGet = vi.fn(),
  layoutsDetails = vi.fn(),
  assets = vi.fn(),
  searchIndex = vi.fn(),
  head = vi.fn(),
  index = vi.fn(),
  treatFile = vi.fn(),
}: {
  rootDir: string
  clientDir: string
  pathExists?: MockedFn
  hasBuildTimeExtensions?: MockedFn
  getExtensionFile?: MockedFn
  loadFiles?: MockedFn
  loadFolders?: MockedFn
  loadMetadata?: MockedFn
  reportBrokenLinks?: MockedFn
  markdownGet?: MockedFn
  layoutsDetails?: MockedFn
  assets?: MockedFn
  searchIndex?: MockedFn
  head?: MockedFn
  index?: MockedFn
  treatFile?: MockedFn
}) {
  let watcher: (() => void) | undefined
  const startHonoServer = vi.fn()
  const printReadyMessage = vi.fn()
  const streamWriteSSE = vi.fn(async () => undefined)
  const streamSSE = vi.fn((c: any, cb: (stream: any) => Promise<void>) => {
    void cb({ writeSSE: streamWriteSSE, close: vi.fn() })
    return c.text('sse')
  })

  vi.doMock('hono/streaming', () => ({
    streamSSE,
  }))
  vi.doMock('fs-extra', async () => {
    const actual = await vi.importActual<typeof import('fs-extra')>('fs-extra')
    const fsModule =
      'default' in actual && actual.default ? actual.default : (actual as any)

    return {
      ...actual,
      default: {
        ...fsModule,
        pathExists,
      },
    }
  })
  vi.doMock('../constants.js', () => ({
    ROOT_DIR: rootDir,
    CLIENT_DIR: clientDir,
  }))
  vi.doMock('../helpers/module.js', () => ({
    ModuleHelpers: {
      resolve: vi.fn((specifier: string) => `${rootDir}/external/${specifier}`),
    },
  }))
  vi.doMock('../helpers/server.js', () => ({
    ServerHelpers: {
      printReadyMessage,
    },
  }))
  vi.doMock('../helpers/hono.js', async () => {
    const actual =
      await vi.importActual<typeof import('../helpers/hono.js')>(
        '../helpers/hono.js',
      )

    return {
      ...actual,
      startHonoServer,
    }
  })
  vi.doMock('../helpers/filesystem.js', () => ({
    FilesystemHelpers: {
      fileWatcher: vi.fn((cb: () => void) => {
        watcher = cb
      }),
    },
  }))
  vi.doMock('../cache/bust-cache.js', () => ({
    BustCache: {
      treatFile,
    },
  }))
  vi.doMock('../cache/html-cache.js', () => ({
    HtmlCache: {
      head,
      index,
    },
  }))
  vi.doMock('../cache/section-cache.js', () => ({
    SectionCache: {
      loadFolders,
    },
  }))
  vi.doMock('../cache/config-cache.js', async () => {
    const actual = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js')

    class MockConfigCache extends actual.ConfigCache {
      static getRoot = vi.fn((root: string) => root)
      static filterConfig = vi.fn(() => ({ title: 'Docs' }))
    }

    return {
      ...actual,
      ConfigCache: MockConfigCache,
    }
  })
  vi.doMock('../cache/metadata-cache.js', () => ({
    MetadataCache: {
      layoutsDetails,
      assets,
      searchIndex,
    },
  }))
  vi.doMock('../cache/markdown-cache.js', () => ({
    MarkdownCache: {
      loadFiles,
      loadMetadata,
      reportBrokenLinks,
      get: markdownGet,
    },
  }))
  vi.doMock('../cache/extensions-cache.js', () => ({
    ExtensionsCache: {
      hasBuildTimeExtensions,
      getExtensionFile,
    },
  }))

  const module = await import('./dev.js')

  return {
    ...module,
    watcher: () => watcher?.(),
    mocks: {
      startHonoServer,
      printReadyMessage,
      streamSSE,
      streamWriteSSE,
      pathExists,
      hasBuildTimeExtensions,
      getExtensionFile,
      loadFiles,
      loadFolders,
      loadMetadata,
      reportBrokenLinks,
      markdownGet,
      layoutsDetails,
      assets,
      searchIndex,
      head,
      index,
      treatFile,
    },
  }
}

describe('commandDev', () => {
  beforeEach(async () => {
    vi.resetModules()
    ;({ ConfigCache } = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js'))
    ConfigCache.reset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    ConfigCache.config = {
      sources: [{ root: 'docs' }],
      server: { host: '127.0.0.1', port: 8000 },
    } as any
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a Hono dev app with live data routes, transformed files, and static fallbacks', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-dev-`)
    const clientDir = await mkdtemp(`${os.tmpdir()}/markee-client-`)

    await mkdir(`${rootDir}/docs`, { recursive: true })
    await mkdir(`${rootDir}/blog`, { recursive: true })
    await mkdir(`${rootDir}/_assets`, { recursive: true })
    await mkdir(`${rootDir}/public`, { recursive: true })
    await mkdir(`${rootDir}/external/pkg`, { recursive: true })
    await mkdir(`${clientDir}/assets`, { recursive: true })

    await writeFile(`${rootDir}/docs/static.txt`, 'docs-static')
    await writeFile(`${rootDir}/docs/index.html`, 'docs-index')
    await writeFile(`${rootDir}/public/logo.txt`, 'public-static')
    await writeFile(`${rootDir}/_assets/local.txt`, 'asset-static')
    await writeFile(`${rootDir}/external/pkg/file.js`, 'extension-file')
    await writeFile(`${rootDir}/extension-logo.svg`, '<svg></svg>')
    await writeFile(`${clientDir}/assets/dev.js`, 'client-static')

    const loadFiles = vi
      .fn()
      .mockResolvedValueOnce({
        '/docs/10.md': {
          link: '/docs/10',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
        '/docs/2.md': {
          link: '/docs/2',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
        '/docs/page.md': {
          link: '/docs/page',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
      })
      .mockResolvedValue({
        '/docs/10.md': {
          link: '/docs/10',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
        '/docs/2.md': {
          link: '/docs/2',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
        '/docs/page.md': {
          link: '/docs/page',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
      })
    const loadFolders = vi.fn().mockResolvedValue({
      '/docs/10': { navigation: [] },
      '/docs/2': { navigation: [] },
      '/docs': { navigation: [] },
    })
    const markdownGet = vi.fn((key: string) => ({
      sanitize: vi.fn().mockResolvedValue(`sanitized:${key}`),
      promise: { sanitized: undefined },
      stale: { sanitized: false },
    }))

    const { createDevApp, watcher, mocks } = await importCommandDev({
      rootDir,
      clientDir,
      pathExists: vi.fn().mockResolvedValue(true),
      loadFiles,
      loadFolders,
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      reportBrokenLinks: vi.fn(),
      markdownGet,
      layoutsDetails: vi.fn().mockResolvedValue({
        header: '/_assets/header.md',
        footer: '/_assets/footer.md',
        layouts: {
          docs: {
            main: '/_assets/layout.md',
          },
        },
      }),
      assets: vi.fn().mockResolvedValue({ '/asset': '/asset' }),
      searchIndex: vi.fn().mockResolvedValue({ '/docs/page.md': {} }),
      head: vi.fn().mockResolvedValue([{ html: '<meta />' }]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
      treatFile: vi.fn(async (file: string) => `busted:${file}`),
      getExtensionFile: vi.fn(async (file: string) =>
        file === '/_assets/logo.svg'
          ? `${rootDir}/extension-logo.svg`
          : undefined,
      ),
    })

    const app = await createDevApp()

    const sse = await app.request('http://localhost/_markee/sse')
    expect(sse.status).toBe(200)

    watcher()
    await app.request('http://localhost/_markee/navigation.json')
    expect(mocks.streamWriteSSE).toHaveBeenCalledWith({
      event: 'fileChange',
      data: '{}',
    })

    const configResponse = await app.request(
      'http://localhost/_markee/config.json',
    )
    expect(await configResponse.json()).toEqual({
      title: 'Docs',
      development: true,
    })

    const navigationResponse = await app.request(
      'http://localhost/_markee/navigation.json',
    )
    expect(await navigationResponse.json()).toEqual({
      folders: {
        '/docs': { navigation: [] },
        '/docs/2': { navigation: [] },
        '/docs/10': { navigation: [] },
      },
      files: {
        '/_assets/footer.md': {
          frontMatter: { excerpt: '' },
          layout: '',
          link: '',
          payload: {},
          readingTime: 0,
        },
        '/_assets/header.md': {
          frontMatter: { excerpt: '' },
          layout: '',
          link: '',
          payload: {},
          readingTime: 0,
        },
        '/_assets/layout.md': {
          frontMatter: { excerpt: '' },
          layout: '',
          link: '',
          payload: {},
          readingTime: 0,
        },
        '/docs/2.md': {
          frontMatter: { excerpt: '' },
          layout: '',
          link: '/docs/2',
          payload: {},
          readingTime: 0,
        },
        '/docs/10.md': {
          frontMatter: { excerpt: '' },
          layout: '',
          link: '/docs/10',
          payload: {},
          readingTime: 0,
        },
        '/docs/page.md': {
          frontMatter: { excerpt: '' },
          layout: '',
          link: '/docs/page',
          payload: {},
          readingTime: 0,
        },
      },
      assets: { '/asset': '/asset' },
    })

    const layoutsResponse = await app.request(
      'http://localhost/_markee/layouts.json',
    )
    expect(await layoutsResponse.json()).toEqual({
      header: '/_assets/header.md',
      footer: '/_assets/footer.md',
      layouts: { docs: { main: '/_assets/layout.md' } },
    })

    const searchResponse = await app.request(
      'http://localhost/_markee/search.json',
    )
    expect(await searchResponse.json()).toEqual({ '/docs/page.md': {} })

    const headResponse = await app.request('http://localhost/_markee/head.json')
    expect(await headResponse.json()).toEqual([{ html: '<meta />' }])

    const markdownResponse = await app.request('http://localhost/docs/page.md')
    expect(markdownResponse.headers.get('content-type')).toBe('text/markdown')
    expect(await markdownResponse.text()).toBe('sanitized:/docs/page.md')

    const extensionMarkdownResponse = await app.request(
      'http://localhost/_assets/_extension/pkg/file.md',
    )
    expect(await extensionMarkdownResponse.text()).toBe(
      'sanitized:/_assets/_extension/pkg/file.md',
    )

    const jsResponse = await app.request('http://localhost/docs/app.js?x=1')
    expect(jsResponse.headers.get('content-type')).toBe('text/javascript')
    expect(await jsResponse.text()).toBe(`busted:${rootDir}/docs/app.js`)

    const cssResponse = await app.request('http://localhost/docs/app.css')
    expect(cssResponse.headers.get('content-type')).toBe('text/css')
    expect(await cssResponse.text()).toBe(`busted:${rootDir}/docs/app.css`)

    const sourceAsset = await app.request('http://localhost/docs/static.txt')
    expect(await sourceAsset.text()).toBe('docs-static')

    const sourceIndex = await app.request('http://localhost/docs')
    expect(await sourceIndex.text()).toBe('docs-index')

    const clientAsset = await app.request('http://localhost/assets/dev.js')
    expect(await clientAsset.text()).toBe('client-static')

    const localAsset = await app.request('http://localhost/_assets/local.txt')
    expect(await localAsset.text()).toBe('asset-static')

    const extensionAsset = await app.request(
      'http://localhost/_assets/_extension/pkg/file.js',
    )
    expect(await extensionAsset.text()).toBe('extension-file')

    const publicAsset = await app.request('http://localhost/logo.txt')
    expect(await publicAsset.text()).toBe('public-static')

    const extensionFallback = await app.request(
      'http://localhost/_assets/logo.svg',
    )
    expect(await extensionFallback.text()).toBe('<svg></svg>')

    const htmlFallback = await app.request('http://localhost/docs/unknown')
    expect(await htmlFallback.text()).toContain(
      "window[Symbol.for('markee::development')] = true",
    )
  })

  it('returns the preloading marker for slow markdown sanitation with build-time extensions enabled', async () => {
    vi.useFakeTimers()

    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-dev-preload-`)
    const clientDir = await mkdtemp(`${os.tmpdir()}/markee-client-preload-`)
    await mkdir(`${rootDir}/docs`, { recursive: true })
    await mkdir(`${rootDir}/blog`, { recursive: true })
    await mkdir(`${rootDir}/_assets`, { recursive: true })
    await mkdir(`${rootDir}/public`, { recursive: true })
    await mkdir(`${clientDir}/assets`, { recursive: true })

    let resolveSanitized = (_value: string) => {}
    const deferred = new Promise<string>((resolve) => {
      resolveSanitized = resolve
    })

    const { createDevApp, mocks } = await importCommandDev({
      rootDir,
      clientDir,
      pathExists: vi.fn().mockResolvedValue(true),
      hasBuildTimeExtensions: vi.fn(() => true),
      loadFiles: vi.fn().mockResolvedValue({
        '/docs/page.md': {
          link: '/docs/page',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          layout: '',
          payload: {},
        },
      }),
      loadFolders: vi.fn().mockResolvedValue({ '/docs': { navigation: [] } }),
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      reportBrokenLinks: vi.fn(),
      markdownGet: vi.fn(() => ({
        sanitize: vi.fn().mockReturnValue(deferred),
        promise: { sanitized: undefined },
        stale: { sanitized: true },
      })),
      layoutsDetails: vi.fn().mockResolvedValue({ layouts: {} }),
      assets: vi.fn().mockResolvedValue({}),
      searchIndex: vi.fn().mockResolvedValue({}),
      head: vi.fn().mockResolvedValue([]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
    })

    const app = await createDevApp()
    const responsePromise = app.request('http://localhost/docs/page.md')

    await vi.advanceTimersByTimeAsync(200)
    const response = await responsePromise
    expect(await response.text()).toBe('::markee-preloading')

    resolveSanitized('late-content')
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(mocks.loadFiles).toHaveBeenCalledTimes(3)
  })

  it('removes aborted sse watchers before the next file-change event', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-dev-sse-`)
    const clientDir = await mkdtemp(`${os.tmpdir()}/markee-client-sse-`)
    await mkdir(`${rootDir}/docs`, { recursive: true })
    await mkdir(`${rootDir}/blog`, { recursive: true })
    await mkdir(`${rootDir}/_assets`, { recursive: true })
    await mkdir(`${rootDir}/public`, { recursive: true })
    await mkdir(`${clientDir}/assets`, { recursive: true })

    const { createDevApp, watcher, mocks } = await importCommandDev({
      rootDir,
      clientDir,
      pathExists: vi.fn().mockResolvedValue(false),
      loadFiles: vi.fn().mockResolvedValue({}),
      loadFolders: vi.fn().mockResolvedValue({}),
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      reportBrokenLinks: vi.fn(),
      markdownGet: vi.fn(() => ({
        sanitize: vi.fn().mockResolvedValue(''),
        promise: { sanitized: undefined },
        stale: { sanitized: false },
      })),
      layoutsDetails: vi.fn().mockResolvedValue({ layouts: {} }),
      assets: vi.fn().mockResolvedValue({}),
      searchIndex: vi.fn().mockResolvedValue({}),
      head: vi.fn().mockResolvedValue([]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
      treatFile: vi.fn(async () => ''),
    })

    const app = await createDevApp()
    const controller = new AbortController()
    controller.abort()

    const response = await app.request('http://localhost/_markee/sse', {
      signal: controller.signal,
    })

    expect(response.status).toBe(200)
    watcher()
    expect(mocks.streamWriteSSE).not.toHaveBeenCalled()
  })

  it('serves source files when a configured source is mounted at the project root', async () => {
    ConfigCache.config.sources = [{ root: '' }] as any

    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-dev-root-`)
    const clientDir = await mkdtemp(`${os.tmpdir()}/markee-client-root-`)
    await mkdir(`${rootDir}/_assets`, { recursive: true })
    await mkdir(`${rootDir}/public`, { recursive: true })
    await mkdir(`${clientDir}/assets`, { recursive: true })
    await writeFile(`${rootDir}/root-static.txt`, 'root-static')

    const { createDevApp } = await importCommandDev({
      rootDir,
      clientDir,
      pathExists: vi.fn().mockResolvedValue(false),
      loadFiles: vi.fn().mockResolvedValue({}),
      loadFolders: vi.fn().mockResolvedValue({}),
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      reportBrokenLinks: vi.fn(),
      markdownGet: vi.fn(() => ({
        sanitize: vi.fn().mockResolvedValue(''),
        promise: { sanitized: undefined },
        stale: { sanitized: false },
      })),
      layoutsDetails: vi.fn().mockResolvedValue({ layouts: {} }),
      assets: vi.fn().mockResolvedValue({}),
      searchIndex: vi.fn().mockResolvedValue({}),
      head: vi.fn().mockResolvedValue([]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
      treatFile: vi.fn(async () => ''),
    })

    const app = await createDevApp()
    const response = await app.request('http://localhost/root-static.txt')

    expect(await response.text()).toBe('root-static')
  })

  it('starts the Hono dev server and prints the ready message after listen', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-dev-command-`)
    const clientDir = await mkdtemp(`${os.tmpdir()}/markee-client-command-`)
    await mkdir(`${rootDir}/docs`, { recursive: true })
    await mkdir(`${rootDir}/blog`, { recursive: true })
    await mkdir(`${rootDir}/_assets`, { recursive: true })
    await mkdir(`${rootDir}/public`, { recursive: true })
    await mkdir(`${clientDir}/assets`, { recursive: true })

    const { commandDev, mocks } = await importCommandDev({
      rootDir,
      clientDir,
      pathExists: vi.fn().mockResolvedValue(false),
      loadFiles: vi.fn().mockResolvedValue({}),
      loadFolders: vi.fn().mockResolvedValue({}),
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      reportBrokenLinks: vi.fn(),
      markdownGet: vi.fn(() => ({
        sanitize: vi.fn().mockResolvedValue(''),
        promise: { sanitized: undefined },
        stale: { sanitized: false },
      })),
      layoutsDetails: vi.fn().mockResolvedValue({ layouts: {} }),
      assets: vi.fn().mockResolvedValue({}),
      searchIndex: vi.fn().mockResolvedValue({}),
      head: vi.fn().mockResolvedValue([]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
      treatFile: vi.fn(async () => ''),
    })

    await commandDev()

    expect(mocks.startHonoServer).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch: expect.any(Function),
        hostname: '127.0.0.1',
        port: 8000,
        onListen: expect.any(Function),
      }),
    )

    expect(mocks.printReadyMessage).not.toHaveBeenCalled()
    mocks.startHonoServer.mock.calls[0]?.[0]?.onListen?.()
    expect(mocks.printReadyMessage).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith('Markdown files tracking enabled')
    expect(console.log).toHaveBeenCalledWith(
      'Start editing and see your changes live in your browser',
    )
  })
})
