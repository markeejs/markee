import Fastify from 'fastify'
import FastifyStatic from '@fastify/static'
import cors from '@fastify/cors'
import { networkInterfaces } from 'node:os'
import colors from 'colors/safe.js'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'

export async function commandServe() {
  const fastify = Fastify()

  fastify.register(cors)

  // Serve all files in the output directory
  fastify.register(FastifyStatic, {
    root: PathHelpers.concat(ROOT_DIR, config.build.outDir),
    wildcard: true,
    decorateReply: true,
    prefix: '/',
  })

  // Default 404 to index file for SPA-like behavior
  fastify.setNotFoundHandler(async (_, reply) => reply.sendFile('index.html'))

  await fastify.listen({
    host: config.server.host,
    port: config.server.port,
  })

  if (config.server.host === '0.0.0.0') {
    let external = '127.0.0.1'
    const interfaces = networkInterfaces()
    for (const devName in interfaces) {
      const iface = interfaces[devName]

      for (let i = 0; i < iface!.length; i++) {
        const alias = iface![i]
        if (
          alias.family === 'IPv4' &&
          alias.address !== '127.0.0.1' &&
          !alias.internal
        ) {
          external = alias.address
          break
        }
      }

      if (external !== '127.0.0.1') {
        break
      }
    }
    console.log(
      colors.bold('Mark' + colors.blue('ee')),
      `preview served on http://localhost:${config.server.port}`,
    )
    console.log(`Or on local network: http://${external}:${config.server.port}`)
  } else {
    console.log(
      colors.bold('Mark' + colors.blue('ee')),
      `preview served on http://${config.server.host}:${config.server.port}`,
    )
  }
}
