import os from 'node:os'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
let ConfigCache: typeof import('../cache/config-cache.js').ConfigCache

async function importCommandServe(rootDir: string) {
  const startHonoServer = vi.fn()
  const printReadyMessage = vi.fn()

  vi.doMock('../constants.js', () => ({
    ROOT_DIR: rootDir,
  }))
  vi.doMock('../helpers/server.js', () => ({
    ServerHelpers: {
      printReadyMessage,
    },
  }))
  vi.doMock('../helpers/hono.js', async () => {
    const actual =
      await vi.importActual<typeof import('../helpers/hono.js')>(
        '../helpers/hono.js',
      )

    return {
      ...actual,
      startHonoServer,
    }
  })

  return {
    ...(await import('./serve.js')),
    startHonoServer,
    printReadyMessage,
  }
}

describe('commandServe', () => {
  beforeEach(async () => {
    vi.resetModules()
    ;({ ConfigCache } = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js'))
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site' },
      server: { host: '127.0.0.1', port: 8000 },
    } as any
  })

  it('serves built assets and falls back to index.html for unknown routes', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-preview-`)
    await mkdir(`${rootDir}/site`, { recursive: true })
    await writeFile(`${rootDir}/site/index.html`, '<html>preview</html>')
    await writeFile(`${rootDir}/site/app.js`, 'console.log("preview")')

    const { createPreviewApp } = await importCommandServe(rootDir)
    const app = createPreviewApp()

    const asset = await app.request('http://localhost/app.js')
    expect(await asset.text()).toBe('console.log("preview")')

    const notFound = await app.request('http://localhost/docs/unknown')
    expect(notFound.status).toBe(200)
    expect(await notFound.text()).toBe('<html>preview</html>')
  })

  it('returns a 404 when the built index file is missing', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-preview-missing-`)
    await mkdir(`${rootDir}/site`, { recursive: true })

    const { createPreviewApp } = await importCommandServe(rootDir)
    const app = createPreviewApp()

    const response = await app.request('http://localhost/docs/unknown')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found')
  })

  it('starts the Hono preview server and prints the ready message after listen', async () => {
    const rootDir = await mkdtemp(`${os.tmpdir()}/markee-preview-command-`)
    await mkdir(`${rootDir}/site`, { recursive: true })
    await writeFile(`${rootDir}/site/index.html`, '<html>preview</html>')

    const { commandServe, startHonoServer, printReadyMessage } =
      await importCommandServe(rootDir)

    await commandServe()

    expect(startHonoServer).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch: expect.any(Function),
        hostname: '127.0.0.1',
        port: 8000,
        onListen: expect.any(Function),
      }),
    )

    expect(printReadyMessage).not.toHaveBeenCalled()
    startHonoServer.mock.calls[0]?.[0]?.onListen?.()
    expect(printReadyMessage).toHaveBeenCalledTimes(1)
  })
})
