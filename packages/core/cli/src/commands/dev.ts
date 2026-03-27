import fs from 'fs-extra'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'

import { CLIENT_DIR, ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'
import { ModuleHelpers } from '../helpers/module.js'
import { ServerHelpers } from '../helpers/server.js'
import { FilesystemHelpers } from '../helpers/filesystem.js'
import {
  createStaticMiddleware,
  sendStaticFile,
  startHonoServer,
} from '../helpers/hono.js'

import { BustCache } from '../cache/bust-cache.js'
import { HtmlCache } from '../cache/html-cache.js'
import { SectionCache } from '../cache/section-cache.js'
import { ConfigCache } from '../cache/config-cache.js'
import { MetadataCache } from '../cache/metadata-cache.js'
import { MarkdownCache } from '../cache/markdown-cache.js'
import { ExtensionsCache } from '../cache/extensions-cache.js'

const wait = (time: number) => {
  return new Promise((resolve) => setTimeout(resolve, time))
}

const defaultMd = () => ({
  link: '',
  frontMatter: { excerpt: '' },
  readingTime: 0,
  layout: '',
  payload: {},
})

function sortEntries<T>(entries: Record<string, T>) {
  return Object.fromEntries(
    Object.entries(entries).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    ),
  )
}

function staticPattern(prefix: string) {
  return prefix === '/' ? '*' : `${prefix}/*`
}

function stripPrefix(path: string, prefix: string) {
  if (prefix === '/') return path

  const stripped = path.slice(prefix.length)
  return stripped || '/'
}

export async function createDevApp() {
  let markdownFiles = await MarkdownCache.loadFiles()
  let sectionFiles = await SectionCache.loadFolders(markdownFiles)

  console.log('Preparing', Object.keys(markdownFiles).length, 'Markdown files')

  const eventWatchers = new Set<() => void>()
  const triggerWatchers = () => eventWatchers.forEach((watcher) => watcher())
  FilesystemHelpers.fileWatcher(() => {
    void buildHotReloadPromise()
  })

  let hotReloadPromise: Promise<void>
  function buildHotReloadPromise() {
    hotReloadPromise = Promise.resolve().then(async () => {
      markdownFiles = await MarkdownCache.loadFiles()
      sectionFiles = await SectionCache.loadFolders(markdownFiles)

      const layouts = await MetadataCache.layoutsDetails()
      if (layouts.header) {
        markdownFiles[layouts.header as string] = defaultMd()
      }
      if (layouts.footer) {
        markdownFiles[layouts.footer as string] = defaultMd()
      }
      Object.keys(layouts.layouts).forEach((layout) => {
        Object.keys(layouts.layouts[layout]).forEach((part) => {
          markdownFiles[layouts.layouts[layout][part as 'main'] as string] =
            defaultMd()
        })
      })

      await MarkdownCache.loadMetadata(markdownFiles, sectionFiles)

      triggerWatchers()
    })

    return hotReloadPromise
  }
  void buildHotReloadPromise()

  const app = new Hono()

  app.use('*', cors())

  app.get('/_assets/_extension/*', async (c, next) => {
    if (c.req.path.endsWith('.md')) {
      await next()
      return
    }

    const extensionPath = c.req.path.slice('/_assets/_extension/'.length)

    return sendStaticFile(
      c,
      PathHelpers.sanitize(ModuleHelpers.resolve(extensionPath)),
    )
  })

  app.get('/_markee/sse', (c) =>
    streamSSE(c, async (stream) => {
      const watcher = () =>
        void stream.writeSSE({ event: 'fileChange', data: '{}' })
      eventWatchers.add(watcher)

      try {
        await new Promise<void>((resolve) => {
          if (c.req.raw.signal.aborted) {
            resolve()
            return
          }

          c.req.raw.signal.addEventListener(
            'abort',
            resolve as unknown as EventListener,
            {
              once: true,
            },
          )
        })
      } finally {
        eventWatchers.delete(watcher)
      }
    }),
  )

  app.get('/_markee/config.json', async (c) =>
    c.json({
      ...ConfigCache.filterConfig(),
      development: true,
    }),
  )

  app.get('/_markee/navigation.json', async (c) => {
    await hotReloadPromise

    return c.json({
      folders: sortEntries(sectionFiles),
      files: sortEntries(markdownFiles),
      assets: await MetadataCache.assets(),
    })
  })

  app.get('/_markee/layouts.json', async (c) => {
    await hotReloadPromise
    return c.json(await MetadataCache.layoutsDetails())
  })

  app.get('/_markee/search.json', async (c) => {
    await hotReloadPromise
    return c.json(await MetadataCache.searchIndex(markdownFiles))
  })

  app.get('/_markee/head.json', async (c) => c.json(await HtmlCache.head()))

  async function sendIndexFile() {
    return (await HtmlCache.index(false)).replace(
      '</head>',
      "<script>window[Symbol.for('markee::development')] = true</script></head>",
    )
  }

  app.get('*', async (c, next) => {
    let [file] = decodeURIComponent(c.req.path).split('?')
    const key = file

    if (key.startsWith('/_assets/_extension/')) {
      const extensionPath = key.slice('/_assets/_extension/'.length)

      file = PathHelpers.relative(
        ROOT_DIR,
        PathHelpers.sanitize(ModuleHelpers.resolve(extensionPath)),
      ).replaceAll(PathHelpers.win32.sep, PathHelpers.posix.sep)
    }

    if (key.endsWith('.md')) {
      if (await fs.pathExists(PathHelpers.concat(ROOT_DIR, file))) {
        const sanitizePromise = MarkdownCache.get(key)
          .sanitize()
          .then((sanitized) => {
            MarkdownCache.reportBrokenLinks(key, sectionFiles)
            return sanitized
          })

        if (
          ExtensionsCache.hasBuildTimeExtensions() &&
          !key.includes('_assets')
        ) {
          const shouldHotReload = !MarkdownCache.get(key).promise.sanitized
          let preloadingSent = false

          if (MarkdownCache.get(key).stale.sanitized) {
            const payload = await Promise.race([
              wait(200).then(() => {
                preloadingSent = true
                return '::markee-preloading'
              }),
              sanitizePromise.then(async (sanitized) => {
                if (shouldHotReload && preloadingSent) {
                  await buildHotReloadPromise()
                }
                return sanitized
              }),
            ])

            return c.body(payload, 200, { 'Content-Type': 'text/markdown' })
          }
        }

        return c.body(await sanitizePromise, 200, {
          'Content-Type': 'text/markdown',
        })
      }
    }

    if (!key.startsWith('/assets/') && key.match(/\.m?js$/)) {
      return c.body(
        await BustCache.treatFile(PathHelpers.concat(ROOT_DIR, file)),
        200,
        {
          'Content-Type': 'text/javascript',
        },
      )
    }

    if (!key.startsWith('/assets/') && key.match(/\.css$/)) {
      return c.body(
        await BustCache.treatFile(PathHelpers.concat(ROOT_DIR, file)),
        200,
        {
          'Content-Type': 'text/css',
        },
      )
    }

    await next()
  })

  ConfigCache.config.sources.forEach((source) => {
    const root = ConfigCache.getRoot(source.root)
    const prefix = PathHelpers.concat('/', root)

    app.use(
      staticPattern(prefix),
      createStaticMiddleware({
        root: PathHelpers.resolve(ROOT_DIR, root),
        rewriteRequestPath: (path) => stripPrefix(path, prefix),
      }),
    )
  })

  app.use(
    '/assets/*',
    createStaticMiddleware({
      root: PathHelpers.resolve(CLIENT_DIR, 'assets'),
      rewriteRequestPath: (path) => stripPrefix(path, '/assets'),
    }),
  )

  app.use(
    '/_assets/*',
    createStaticMiddleware({
      root: PathHelpers.resolve(ROOT_DIR, '_assets'),
      rewriteRequestPath: (path) => stripPrefix(path, '/_assets'),
    }),
  )

  app.use(
    '*',
    createStaticMiddleware({ root: PathHelpers.resolve(ROOT_DIR, 'public') }),
  )

  app.notFound(async (c) => {
    if (c.req.path.startsWith('/_assets')) {
      const filePath = await ExtensionsCache.getExtensionFile(c.req.path)

      if (filePath) {
        return sendStaticFile(c, filePath)
      }
    }

    return c.html(await sendIndexFile())
  })

  return app
}

export async function commandDev() {
  const app = await createDevApp()

  await startHonoServer({
    fetch: app.fetch,
    hostname: ConfigCache.config.server.host,
    port: ConfigCache.config.server.port,
    onListen: () => {
      console.log('Markdown files tracking enabled')
      console.log('Start editing and see your changes live in your browser')
      ServerHelpers.printReadyMessage()
    },
  })
}
