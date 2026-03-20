import Fastify, { type FastifyReply } from 'fastify'
import FastifyStatic from '@fastify/static'
import { FastifySSEPlugin } from 'fastify-sse-v2'
import cors from '@fastify/cors'
import fs from 'fs-extra'

import { CLIENT_DIR, ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'
import { ServerHelpers } from '../helpers/server.js'
import { FilesystemHelpers } from '../helpers/filesystem.js'

import { BustCache } from '../cache/bust-cache.js'
import { HtmlCache } from '../cache/html-cache.js'
import { PagesCache } from '../cache/pages-cache.js'
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

export async function commandDev() {
  // Build navigation tree
  let markdownFiles = await MarkdownCache.loadFiles()
  let pagesFiles = await PagesCache.loadFolders(markdownFiles)

  console.log('Preparing', Object.keys(markdownFiles).length, 'Markdown files')

  const eventWatchers = new Set<() => void>()
  const triggerWatchers = () => eventWatchers.forEach((w) => w())
  FilesystemHelpers.fileWatcher(() => {
    void buildHotReloadPromise()
  })

  let hotReloadPromise: Promise<void>
  function buildHotReloadPromise() {
    // Rebuild navigation tree with cache-busted files
    hotReloadPromise = Promise.resolve().then(async () => {
      markdownFiles = await MarkdownCache.loadFiles()
      pagesFiles = await PagesCache.loadFolders(markdownFiles)

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

      await MarkdownCache.loadMetadata(markdownFiles, pagesFiles)

      triggerWatchers()
    })
    return hotReloadPromise
  }
  void buildHotReloadPromise()

  const fastify = Fastify()

  fastify.register(cors)
  fastify.register(FastifySSEPlugin)

  // Serve all files from sources
  config.sources.forEach((source) => {
    fastify.register(FastifyStatic, {
      root: PathHelpers.resolve(ROOT_DIR, ConfigCache.getRoot(source.root)),
      wildcard: true,
      decorateReply: false,
      prefix: PathHelpers.concat('/', ConfigCache.getRoot(source.root)),
    })
  })

  // Serve all files in the @markee/client
  fastify.register(FastifyStatic, {
    root: PathHelpers.resolve(CLIENT_DIR, 'assets'),
    wildcard: true,
    decorateReply: false,
    prefix: '/assets',
  })

  // Serve all files from /_assets
  fastify.register(FastifyStatic, {
    root: PathHelpers.resolve(ROOT_DIR, '_assets'),
    wildcard: true,
    decorateReply: false,
    prefix: '/_assets',
  })

  // Serve all files from /public
  fastify.register(FastifyStatic, {
    root: PathHelpers.resolve(ROOT_DIR, 'public'),
    wildcard: true,
    decorateReply: true,
    prefix: '/',
  })

  // Serve extensions on /_assets/_extension
  fastify.get(
    '/_assets/_extension/*',
    async (req, res) =>
      await res.sendFile(
        PathHelpers.sanitize(
          new URL(import.meta.resolve((req.params as any)['*'])).pathname,
        ),
        '/',
      ),
  )

  fastify.get('/_markee/sse', (req, res) => {
    const watcher = () => res.sse({ event: 'fileChange', data: '{}' })
    eventWatchers.add(watcher)
    req.socket.on('close', () => eventWatchers.delete(watcher))
  })

  fastify.get('/_markee/config.json', async () => ({
    ...ConfigCache.filterConfig(),
    development: true,
  }))

  fastify.get('/_markee/navigation.json', async () => {
    await hotReloadPromise
    return {
      folders: Object.fromEntries(
        Object.entries(pagesFiles).sort((a, b) =>
          a[0].localeCompare(b[0], undefined, {
            numeric: true,
            sensitivity: 'base',
          }),
        ),
      ),
      files: Object.fromEntries(
        Object.entries(markdownFiles).sort((a, b) =>
          a[0].localeCompare(b[0], undefined, {
            numeric: true,
            sensitivity: 'base',
          }),
        ),
      ),
      assets: await MetadataCache.assets(),
    }
  })

  fastify.get('/_markee/layouts.json', async () => {
    await hotReloadPromise
    return MetadataCache.layoutsDetails()
  })

  fastify.get('/_markee/search.json', async () => {
    await hotReloadPromise
    return MetadataCache.searchIndex(markdownFiles)
  })

  fastify.get('/_markee/head.json', async () => {
    return HtmlCache.head()
  })

  async function sendIndexFile(reply: FastifyReply) {
    reply.type('text/html')
    return (await HtmlCache.index(false)).replace(
      '</head>',
      "<script>window[Symbol.for('markee::development')] = true</script></head>",
    )
  }

  // Catch MD files to resolve inclusions
  // Catch JS and CSS files to cache-bust imports
  fastify.addHook('onSend', async (req, reply, payload) => {
    if (reply.sent) return payload

    let [file] = decodeURIComponent(req.url).split('?')
    const key = file
    if (key.startsWith('/_assets/_extension/')) {
      file = PathHelpers.relative(
        ROOT_DIR,
        PathHelpers.sanitize(
          new URL(import.meta.resolve((req.params as any)['*'])).pathname,
        ),
      ).replaceAll(PathHelpers.win32.sep, PathHelpers.posix.sep)
    }

    if (key?.endsWith('.md')) {
      if (await fs.pathExists(PathHelpers.concat(ROOT_DIR, file))) {
        reply.status(200)
        reply.type('text/markdown')

        const sanitizePromise = MarkdownCache.get(key)
          .sanitize()
          .then((sanitized) => {
            MarkdownCache.reportBrokenLinks(key, pagesFiles)
            return sanitized
          })

        if (
          ExtensionsCache.hasBuildTimeExtensions() &&
          !key.includes('_assets')
        ) {
          const shouldHotReload = !MarkdownCache.get(key).promise.sanitized
          let preloadingSent = false

          if (MarkdownCache.get(key).stale.sanitized) {
            return await Promise.race([
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
          }
        }

        return sanitizePromise
      }
    }
    if (key?.match(/\.m?js(\?.*)$/)) {
      reply.status(200)
      reply.type('text/javascript')

      return await BustCache.treatFile(PathHelpers.concat(ROOT_DIR, file))
    }
    if (key?.match(/\.css(\?.*)$/)) {
      reply.status(200)
      reply.type('text/css')

      return await BustCache.treatFile(PathHelpers.concat(ROOT_DIR, file))
    }

    return payload
  })

  fastify.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/_assets')) {
      const filePath = await ExtensionsCache.getExtensionFile(req.url)

      if (filePath) {
        return reply.sendFile(filePath, '/')
      }
    }

    return sendIndexFile(reply)
  })

  await fastify.listen({
    host: config.server.host,
    port: config.server.port,
  })

  console.log('Markdown files tracking enabled')
  console.log('Start editing and see your changes live in your browser')

  ServerHelpers.printReadyMessage()
}
