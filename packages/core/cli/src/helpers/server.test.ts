import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importServer(interfaces: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  vi.doMock('node:os', () => ({
    default: { networkInterfaces: interfaces },
  }))

  return await import('./server.js')
}

describe('ServerHelpers', () => {
  beforeEach(() => {
    global.config = {
      server: { host: '0.0.0.0', port: 8000 },
    } as any
  })

  it('finds the first non-local external ipv4 address', async () => {
    const { ServerHelpers } = await importServer(
      vi.fn(() => ({
        lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
        en0: [
          { family: 'IPv6', address: '::1', internal: false },
          { family: 'IPv4', address: '192.168.1.24', internal: false },
        ],
      })),
    )

    expect(ServerHelpers.getExternalIP()).toBe('192.168.1.24')
  })

  it('falls back to localhost when no external ipv4 address is available', async () => {
    const { ServerHelpers } = await importServer(
      vi.fn(() => ({
        lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      })),
    )

    expect(ServerHelpers.getExternalIP()).toBe('127.0.0.1')
  })

  it('prints the correct ready message for public and bound hosts', async () => {
    const { ServerHelpers } = await importServer(vi.fn(() => ({})))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(ServerHelpers, 'getExternalIP').mockReturnValue('192.168.1.24')

    ServerHelpers.printReadyMessage()
    expect(log).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('http://localhost:8000'),
    )
    expect(log).toHaveBeenNthCalledWith(
      2,
      'Or on local network: http://192.168.1.24:8000',
    )

    global.config.server.host = '127.0.0.1'
    global.config.server.port = 9000

    ServerHelpers.printReadyMessage()
    expect(log).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('http://127.0.0.1:9000'),
    )
  })
})
