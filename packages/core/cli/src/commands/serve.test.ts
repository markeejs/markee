import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importCommandServe() {
  vi.resetModules()

  const register = vi.fn()
  const setNotFoundHandler = vi.fn()
  const listen = vi.fn().mockResolvedValue(undefined)
  const fastify = {
    register,
    setNotFoundHandler,
    listen,
  }
  const printReadyMessage = vi.fn()
  const fastifyStatic = Symbol('FastifyStatic')
  const cors = Symbol('cors')

  vi.doMock('fastify', () => ({
    default: vi.fn(() => fastify),
  }))
  vi.doMock('@fastify/static', () => ({
    default: fastifyStatic,
  }))
  vi.doMock('@fastify/cors', () => ({
    default: cors,
  }))
  vi.doMock('../helpers/server.js', () => ({
    ServerHelpers: {
      printReadyMessage,
    },
  }))

  return {
    ...(await import('./serve.js')),
    register,
    setNotFoundHandler,
    listen,
    printReadyMessage,
    fastifyStatic,
    cors,
  }
}

describe('commandServe', () => {
  beforeEach(() => {
    global.config = {
      build: { outDir: 'site' },
      server: { host: '127.0.0.1', port: 8000 },
    } as any
  })

  it('serves the output directory, falls back to index.html, and prints the ready message', async () => {
    const {
      commandServe,
      register,
      setNotFoundHandler,
      listen,
      printReadyMessage,
      fastifyStatic,
      cors,
    } = await importCommandServe()

    await commandServe()

    expect(register).toHaveBeenCalledWith(cors)
    expect(register).toHaveBeenCalledWith(
      fastifyStatic,
      expect.objectContaining({
        root: expect.stringContaining('/site'),
        wildcard: true,
        decorateReply: true,
        prefix: '/',
      }),
    )

    const notFound = setNotFoundHandler.mock.calls[0]?.[0]
    const reply = { sendFile: vi.fn() }
    await notFound({}, reply)
    expect(reply.sendFile).toHaveBeenCalledWith('index.html')

    expect(listen).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 8000,
    })
    expect(printReadyMessage).toHaveBeenCalledTimes(1)
  })
})
