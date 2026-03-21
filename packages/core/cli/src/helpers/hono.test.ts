import os from 'node:os'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

async function importHonoHelpers() {
  vi.resetModules()
  return await import('./hono.js')
}

async function importHonoHelpersWithNodeServe() {
  vi.resetModules()

  const serve = vi.fn()
  vi.doMock('@hono/node-server', () => ({
    serve,
  }))

  return {
    ...(await import('./hono.js')),
    serve,
  }
}

describe('HonoHelpers', () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { Bun?: unknown }).Bun
  })

  it('sends files directly and supports HEAD requests', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-hono-send-`)
    await writeFile(`${rootDir}/file.txt`, 'hello world')
    await writeFile(`${rootDir}/file.data`, 'raw bytes')

    const { sendStaticFile } = await importHonoHelpers()
    const app = new Hono()

    app.get('/file', (c) => sendStaticFile(c, `${rootDir}/file.txt`))
    app.get('/binary', (c) => sendStaticFile(c, `${rootDir}/file.data`))
    app.on('HEAD', '/file', (c) => sendStaticFile(c, `${rootDir}/file.txt`))
    app.get('/missing', (c) => sendStaticFile(c, `${rootDir}/missing.txt`))

    const fileResponse = await app.request('http://localhost/file')
    expect(fileResponse.headers.get('content-type')).toContain('text/plain')
    expect(fileResponse.headers.get('content-length')).toBe('11')
    expect(await fileResponse.text()).toBe('hello world')

    const headResponse = await app.request('http://localhost/file', {
      method: 'HEAD',
    })
    expect(headResponse.headers.get('content-length')).toBe('11')
    expect(await headResponse.text()).toBe('')

    const binaryResponse = await app.request('http://localhost/binary')
    expect(binaryResponse.headers.get('content-type')).toBe(
      'application/octet-stream',
    )
    expect(await binaryResponse.text()).toBe('raw bytes')

    const missingResponse = await app.request('http://localhost/missing')
    expect(missingResponse.status).toBe(404)
    expect(await missingResponse.text()).toBe('Not Found')
  })

  it('creates static middleware for rewritten paths, directory indexes, and missing files', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-hono-static-`)
    await mkdir(`${rootDir}/nested`, { recursive: true })
    await mkdir(`${rootDir}/empty`, { recursive: true })
    await writeFile(`${rootDir}/file.txt`, 'root file')
    await writeFile(`${rootDir}/nested/index.html`, '<html>nested</html>')
    await writeFile(`${rootDir}/secret.txt`, 'secret')

    const { createStaticMiddleware } = await importHonoHelpers()
    const app = new Hono()

    app.use(
      '/docs/*',
      createStaticMiddleware({
        root: rootDir,
        rewriteRequestPath: (path) => path.slice('/docs'.length) || '/',
      }),
    )
    app.get('*', (c) => c.text('fallback', 404))

    const fileResponse = await app.request('http://localhost/docs/file.txt')
    expect(await fileResponse.text()).toBe('root file')

    const indexResponse = await app.request('http://localhost/docs/nested')
    expect(await indexResponse.text()).toBe('<html>nested</html>')

    const emptyDirResponse = await app.request('http://localhost/docs/empty')
    expect(emptyDirResponse.status).toBe(404)
    expect(await emptyDirResponse.text()).toBe('fallback')

    const missingResponse = await app.request(
      'http://localhost/docs/missing.txt',
    )
    expect(missingResponse.status).toBe(404)
    expect(await missingResponse.text()).toBe('fallback')

    const traversalApp = new Hono()
    traversalApp.use(
      '*',
      createStaticMiddleware({
        root: rootDir,
        rewriteRequestPath: () => '/../secret.txt',
      }),
    )
    traversalApp.get('*', (c) => c.text('fallback', 404))

    const traversalResponse = await traversalApp.request(
      'http://localhost/anything',
    )
    expect(traversalResponse.status).toBe(404)
    expect(await traversalResponse.text()).toBe('fallback')

    const directApp = new Hono()
    directApp.use(
      '*',
      createStaticMiddleware({
        root: rootDir,
      }),
    )
    directApp.get('*', (c) => c.text('fallback', 404))

    const directResponse = await directApp.request('http://localhost/file.txt')
    expect(await directResponse.text()).toBe('root file')
  })

  it('starts with Bun when available', async () => {
    const { startHonoServer } = await importHonoHelpers()
    const bunServe = vi.fn()
    const onListen = vi.fn()

    ;(globalThis as typeof globalThis & { Bun?: unknown }).Bun = {
      serve: bunServe,
    }

    await startHonoServer({
      fetch: () => new Response('bun'),
      hostname: '0.0.0.0',
      port: 3000,
      onListen,
    })

    expect(bunServe).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      hostname: '0.0.0.0',
      port: 3000,
    })
    expect(onListen).toHaveBeenCalledTimes(1)
  })

  it('falls back to @hono/node-server when Bun is unavailable', async () => {
    const { startHonoServer, serve } = await importHonoHelpersWithNodeServe()
    const onListen = vi.fn()

    await startHonoServer({
      fetch: () => new Response('node'),
      hostname: '127.0.0.1',
      port: 8000,
      onListen,
    })

    expect(serve).toHaveBeenCalledWith(
      {
        fetch: expect.any(Function),
        hostname: '127.0.0.1',
        port: 8000,
      },
      expect.any(Function),
    )

    expect(onListen).not.toHaveBeenCalled()
    serve.mock.calls[0]?.[1]?.({
      address: '127.0.0.1',
      family: 'IPv4',
      port: 8000,
    })
    expect(onListen).toHaveBeenCalledTimes(1)
  })
})
