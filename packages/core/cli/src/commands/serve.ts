import fs from 'fs-extra'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'
import { ServerHelpers } from '../helpers/server.js'
import {
  createStaticMiddleware,
  sendStaticFile,
  startHonoServer,
} from '../helpers/hono.js'

export function createPreviewApp() {
  const app = new Hono()
  const outputDir = PathHelpers.concat(ROOT_DIR, config.build.outDir)

  app.use('*', cors())
  app.use('*', createStaticMiddleware({ root: outputDir }))

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

  await startHonoServer({
    fetch: app.fetch,
    hostname: config.server.host,
    port: config.server.port,
    onListen: () => {
      ServerHelpers.printReadyMessage()
    },
  })
}
