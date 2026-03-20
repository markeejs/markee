import Fastify from 'fastify'
import FastifyStatic from '@fastify/static'
import cors from '@fastify/cors'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'
import { ServerHelpers } from '../helpers/server.js'

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
  ServerHelpers.printReadyMessage()
}
