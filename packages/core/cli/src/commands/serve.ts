import fs from 'fs-extra'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'
import { ServerHelpers } from '../helpers/server.js'

async function sendStaticFile(
  c: Parameters<ReturnType<typeof serveStatic>>[0],
  filePath: string,
) {
  const middleware = serveStatic({
    root: PathHelpers.dirname(filePath),
    path: PathHelpers.basename(filePath),
  })

  return (await middleware(c, async () => {})) as Response
}

export function createPreviewApp() {
  const app = new Hono()
  const outputDir = PathHelpers.concat(ROOT_DIR, config.build.outDir)

  app.use('*', cors())
  app.use('*', serveStatic({ root: outputDir }))

  app.notFound(async (c) => {
    if (!(await fs.pathExists(PathHelpers.concat(outputDir, 'index.html')))) {
      return c.text('Not Found', 404)
    }

    return sendStaticFile(c, PathHelpers.concat(outputDir, 'index.html'))
  })

  return app
}

export async function commandServe() {
  const app = createPreviewApp()

  serve({
    fetch: app.fetch,
    hostname: config.server.host,
    port: config.server.port,
  }, () => {
    ServerHelpers.printReadyMessage()
  })
}
