import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type FastifyApp = {
  registers: Array<[unknown, unknown]>
  routes: Map<string, any>
  hooks: Record<string, any>
  notFoundHandler?: any
  register: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  addHook: ReturnType<typeof vi.fn>
  setNotFoundHandler: ReturnType<typeof vi.fn>
  listen: ReturnType<typeof vi.fn>
}

function createFastifyApp(): FastifyApp {
  const app = {
    registers: [] as Array<[unknown, unknown]>,
    routes: new Map<string, any>(),
    hooks: {} as Record<string, any>,
    notFoundHandler: undefined as any,
    register: vi.fn((plugin: unknown, options?: unknown) => {
      app.registers.push([plugin, options])
      return app
    }),
    get: vi.fn((route: string, handler: any) => {
      app.routes.set(route, handler)
      return app
    }),
    addHook: vi.fn((name: string, handler: any) => {
      app.hooks[name] = handler
      return app
    }),
    setNotFoundHandler: vi.fn((handler: any) => {
      app.notFoundHandler = handler
      return app
    }),
    listen: vi.fn().mockResolvedValue(undefined),
  }

  return app
}

async function importCommandDev({
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
  pathExists?: ReturnType<typeof vi.fn>
  hasBuildTimeExtensions?: ReturnType<typeof vi.fn>
  getExtensionFile?: ReturnType<typeof vi.fn>
  loadFiles?: ReturnType<typeof vi.fn>
  loadFolders?: ReturnType<typeof vi.fn>
  loadMetadata?: ReturnType<typeof vi.fn>
  reportBrokenLinks?: ReturnType<typeof vi.fn>
  markdownGet?: ReturnType<typeof vi.fn>
  layoutsDetails?: ReturnType<typeof vi.fn>
  assets?: ReturnType<typeof vi.fn>
  searchIndex?: ReturnType<typeof vi.fn>
  head?: ReturnType<typeof vi.fn>
  index?: ReturnType<typeof vi.fn>
  treatFile?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  const app = createFastifyApp()
  let watcher: (() => void) | undefined

  vi.doMock('fastify', () => ({
    default: vi.fn(() => app),
  }))
  vi.doMock('@fastify/static', () => ({
    default: { name: 'static' },
  }))
  vi.doMock('fastify-sse-v2', () => ({
    FastifySSEPlugin: { name: 'sse' },
  }))
  vi.doMock('@fastify/cors', () => ({
    default: { name: 'cors' },
  }))
  vi.doMock('fs-extra', () => ({
    default: {
      pathExists,
    },
  }))
  vi.doMock('../constants.js', () => ({
    ROOT_DIR: '/project',
    CLIENT_DIR: '/client',
  }))
  vi.doMock('../helpers/module.js', () => ({
    ModuleHelpers: {
      resolve: vi.fn((specifier: string) => `/resolved/${specifier}`),
    },
  }))
  vi.doMock('../helpers/server.js', () => ({
    ServerHelpers: {
      printReadyMessage: vi.fn(),
    },
  }))
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
  vi.doMock('../cache/config-cache.js', () => ({
    ConfigCache: {
      getRoot: vi.fn((root: string) => root),
      filterConfig: vi.fn(() => ({ title: 'Docs' })),
    },
  }))
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
  const { ServerHelpers } = await import('../helpers/server.js')

  return {
    ...module,
    app,
    watcher: () => watcher?.(),
    mocks: {
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
      printReadyMessage: ServerHelpers.printReadyMessage as ReturnType<
        typeof vi.fn
      >,
    },
  }
}

describe('commandDev', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    global.config = {
      sources: [{ root: 'docs' }, { root: 'blog' }],
      server: { host: '127.0.0.1', port: 8000 },
    } as any
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers the dev server routes, serves navigation/config/head data, and handles assets and source files', async () => {
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
    const loadMetadata = vi.fn().mockResolvedValue(undefined)
    const layoutsDetails = vi.fn().mockResolvedValue({
      header: '/_assets/header.md',
      footer: '/_assets/footer.md',
      layouts: {
        docs: {
          main: '/_assets/layout.md',
        },
      },
    })
    const markdownGet = vi.fn((key: string) => ({
      sanitize: vi.fn().mockResolvedValue(`sanitized:${key}`),
      promise: { sanitized: undefined },
      stale: { sanitized: false },
    }))
    const { commandDev, app, watcher, mocks } = await importCommandDev({
      pathExists: vi.fn().mockResolvedValue(true),
      loadFiles,
      loadFolders,
      loadMetadata,
      reportBrokenLinks: vi.fn(),
      markdownGet,
      layoutsDetails,
      assets: vi.fn().mockResolvedValue({ '/asset': '/asset' }),
      searchIndex: vi.fn().mockResolvedValue({ '/docs/page.md': {} }),
      head: vi.fn().mockResolvedValue([{ html: '<meta />' }]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
      treatFile: vi.fn(async (file: string) => `busted:${file}`),
      getExtensionFile: vi.fn(async (file: string) =>
        file === '/_assets/logo.svg' ? '/extension/logo.svg' : undefined,
      ),
    })

    await commandDev()

    expect(app.register).toHaveBeenCalledTimes(7)
    expect(app.listen).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 8000,
    })
    expect(mocks.printReadyMessage).toHaveBeenCalledTimes(1)

    const extensionReply = { sendFile: vi.fn().mockResolvedValue('sent') }
    await expect(
      app.routes.get('/_assets/_extension/*')?.(
        { params: { '*': 'pkg/file.js' } },
        extensionReply,
      ),
    ).resolves.toBe('sent')
    expect(extensionReply.sendFile).toHaveBeenCalledWith(
      '/resolved/pkg/file.js',
      '/',
    )

    const closeHandlers: Array<() => void> = []
    const sseReply = { sse: vi.fn() }
    app.routes.get('/_markee/sse')?.(
      {
        socket: {
          on: vi.fn((_event: string, cb: () => void) => closeHandlers.push(cb)),
        },
      },
      sseReply,
    )
    watcher()
    await app.routes.get('/_markee/navigation.json')?.()
    expect(sseReply.sse).toHaveBeenCalledWith({
      event: 'fileChange',
      data: '{}',
    })
    closeHandlers[0]?.()

    await expect(app.routes.get('/_markee/config.json')?.()).resolves.toEqual({
      title: 'Docs',
      development: true,
    })
    const navigation = await app.routes.get('/_markee/navigation.json')?.()
    expect(Object.keys(navigation.folders)).toEqual([
      '/docs',
      '/docs/2',
      '/docs/10',
    ])
    expect(Object.keys(navigation.files)).toEqual([
      '/_assets/footer.md',
      '/_assets/header.md',
      '/_assets/layout.md',
      '/docs/2.md',
      '/docs/10.md',
      '/docs/page.md',
    ])
    expect(navigation.assets).toEqual({ '/asset': '/asset' })
    await expect(app.routes.get('/_markee/layouts.json')?.()).resolves.toEqual({
      header: '/_assets/header.md',
      footer: '/_assets/footer.md',
      layouts: { docs: { main: '/_assets/layout.md' } },
    })
    await expect(app.routes.get('/_markee/search.json')?.()).resolves.toEqual({
      '/docs/page.md': {},
    })
    await expect(app.routes.get('/_markee/head.json')?.()).resolves.toEqual([
      { html: '<meta />' },
    ])

    const markdownReply = {
      sent: false,
      status: vi.fn(),
      type: vi.fn(),
    }
    await expect(
      app.hooks.onSend?.(
        { url: '/docs/page.md', params: {} },
        markdownReply,
        'payload',
      ),
    ).resolves.toBe('sanitized:/docs/page.md')
    expect(markdownReply.status).toHaveBeenCalledWith(200)
    expect(markdownReply.type).toHaveBeenCalledWith('text/markdown')

    const extensionMarkdownReply = {
      sent: false,
      status: vi.fn(),
      type: vi.fn(),
    }
    await expect(
      app.hooks.onSend?.(
        {
          url: '/_assets/_extension/pkg/file.md',
          params: { '*': 'pkg/file.md' },
        },
        extensionMarkdownReply,
        'payload',
      ),
    ).resolves.toBe('sanitized:/_assets/_extension/pkg/file.md')

    const jsReply = { sent: false, status: vi.fn(), type: vi.fn() }
    await expect(
      app.hooks.onSend?.(
        { url: '/docs/app.js?x=1', params: {} },
        jsReply,
        'payload',
      ),
    ).resolves.toBe('busted:/project/docs/app.js')
    expect(jsReply.type).toHaveBeenCalledWith('text/javascript')

    const cssReply = { sent: false, status: vi.fn(), type: vi.fn() }
    await expect(
      app.hooks.onSend?.(
        { url: '/docs/app.css', params: {} },
        cssReply,
        'payload',
      ),
    ).resolves.toBe('busted:/project/docs/app.css')
    expect(cssReply.type).toHaveBeenCalledWith('text/css')

    const passthroughReply = { sent: true }
    await expect(
      app.hooks.onSend?.(
        { url: '/docs/page.md', params: {} },
        passthroughReply,
        'payload',
      ),
    ).resolves.toBe('payload')
    await expect(
      app.hooks.onSend?.(
        { url: '/docs/image.png', params: {} },
        { sent: false },
        'payload',
      ),
    ).resolves.toBe('payload')

    const assetNotFoundReply = { sendFile: vi.fn().mockResolvedValue('asset') }
    await expect(
      app.notFoundHandler?.({ url: '/_assets/logo.svg' }, assetNotFoundReply),
    ).resolves.toBe('asset')
    expect(assetNotFoundReply.sendFile).toHaveBeenCalledWith(
      '/extension/logo.svg',
      '/',
    )

    const htmlNotFoundReply = {
      sendFile: vi.fn(),
      type: vi.fn(),
    }
    await expect(
      app.notFoundHandler?.({ url: '/docs/unknown' }, htmlNotFoundReply),
    ).resolves.toContain("window[Symbol.for('markee::development')] = true")
    expect(htmlNotFoundReply.type).toHaveBeenCalledWith('text/html')
  })

  it('returns the preloading marker for slow markdown sanitation with build-time extensions enabled', async () => {
    vi.useFakeTimers()

    let resolveSanitized = (_value: string) => {}
    const deferred = new Promise<string>((resolve) => {
      resolveSanitized = resolve
    })
    const loadFiles = vi.fn().mockResolvedValue({
      '/docs/page.md': {
        link: '/docs/page',
        frontMatter: { excerpt: '' },
        readingTime: 0,
        layout: '',
        payload: {},
      },
    })
    const loadFolders = vi
      .fn()
      .mockResolvedValue({ '/docs': { navigation: [] } })
    const markdownGet = vi.fn(() => ({
      sanitize: vi.fn().mockReturnValue(deferred),
      promise: { sanitized: undefined },
      stale: { sanitized: true },
    }))
    const { commandDev, app, mocks } = await importCommandDev({
      pathExists: vi.fn().mockResolvedValue(true),
      hasBuildTimeExtensions: vi.fn(() => true),
      loadFiles,
      loadFolders,
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      reportBrokenLinks: vi.fn(),
      markdownGet,
      layoutsDetails: vi.fn().mockResolvedValue({ layouts: {} }),
      assets: vi.fn().mockResolvedValue({}),
      searchIndex: vi.fn().mockResolvedValue({}),
      head: vi.fn().mockResolvedValue([]),
      index: vi.fn().mockResolvedValue('<html><head></head></html>'),
    })

    await commandDev()

    const reply = { sent: false, status: vi.fn(), type: vi.fn() }
    const onSendPromise = app.hooks.onSend?.(
      { url: '/docs/page.md', params: {} },
      reply,
      'payload',
    )

    await vi.advanceTimersByTimeAsync(200)
    await expect(onSendPromise).resolves.toBe('::markee-preloading')

    resolveSanitized('late-content')
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(mocks.loadFiles).toHaveBeenCalledTimes(3)
  })
})
