import fs from 'fs-extra'
import type { Context, MiddlewareHandler } from 'hono'
import { getMimeType } from 'hono/utils/mime'

import { PathHelpers } from './path.js'

type FetchHandler = (request: Request) => Response | Promise<Response>

type StartServerOptions = {
  fetch: FetchHandler
  hostname: string
  port: number
  onListen?: () => void
}

type BunServe = (options: {
  fetch: FetchHandler
  hostname?: string
  port: number
}) => unknown

type StaticMiddlewareOptions = {
  root: string
  index?: string
  rewriteRequestPath?: (path: string) => string
}

function resolveStaticPath(root: string, requestPath: string) {
  const normalizedRoot = PathHelpers.resolve(root)
  const normalizedRequestPath = requestPath.replaceAll(
    PathHelpers.win32.sep,
    PathHelpers.posix.sep,
  )

  if (/(?:^|\/)\.\.(?:\/|$)/.test(normalizedRequestPath)) {
    return null
  }

  const relativePath = requestPath.startsWith('/')
    ? `.${requestPath}`
    : requestPath
  return PathHelpers.resolve(normalizedRoot, relativePath)
}

async function resolveExistingStaticPath(
  root: string,
  requestPath: string,
  index = 'index.html',
) {
  const candidate = resolveStaticPath(root, requestPath)
  if (!candidate) return null

  const stats = await fs.stat(candidate).catch(() => null)
  if (!stats) return null

  if (stats.isDirectory()) {
    const indexPath = PathHelpers.concat(candidate, index)
    return (await fs.pathExists(indexPath)) ? indexPath : null
  }

  return candidate
}

export async function sendStaticFile(c: Context, filePath: string) {
  const existingPath = await resolveExistingStaticPath(
    PathHelpers.dirname(filePath),
    PathHelpers.basename(filePath),
  )

  if (!existingPath) {
    return c.text('Not Found', 404)
  }

  const content = await fs.readFile(existingPath)
  const mimeType = getMimeType(existingPath) || 'application/octet-stream'
  const headers = {
    'Content-Length': String(content.byteLength),
    'Content-Type': mimeType,
  }

  if (c.req.method === 'HEAD') {
    return c.body(null, 200, headers)
  }

  return c.body(content as never, 200, headers)
}

export function createStaticMiddleware(
  options: StaticMiddlewareOptions,
): MiddlewareHandler {
  return async (c, next) => {
    const requestPath =
      options.rewriteRequestPath?.(decodeURIComponent(c.req.path)) ?? c.req.path

    const filePath = await resolveExistingStaticPath(
      options.root,
      requestPath,
      options.index,
    )

    if (!filePath) {
      await next()
      return
    }

    return sendStaticFile(c, filePath)
  }
}

export async function startHonoServer({
  fetch,
  hostname,
  port,
  onListen,
}: StartServerOptions) {
  const bunServe = (
    globalThis as typeof globalThis & { Bun?: { serve?: BunServe } }
  ).Bun?.serve

  if (bunServe) {
    bunServe({
      fetch,
      hostname,
      port,
    })
    onListen?.()
    return
  }

  const { serve } = await import('@hono/node-server')
  serve(
    {
      fetch,
      hostname,
      port,
    },
    () => {
      onListen?.()
    },
  )
}
