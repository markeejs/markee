import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importConfigCache(readFile: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  vi.doMock('fs-extra', () => ({
    default: {
      readFile,
    },
  }))

  return await import('./config-cache.js')
}

describe('ConfigCache', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads config with fallback files and merges defaults with options', async () => {
    const readFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing yaml'))
      .mockResolvedValueOnce(
        'title: Docs\nbuild:\n  outDir: dist\nserver:\n  port: 7000\nsources:\n  - root: docs\n',
      )

    const { ConfigCache } = await importConfigCache(readFile)

    await ConfigCache.loadConfig('/repo', {
      host: '127.0.0.1',
      port: 9001,
      outDir: 'public-site',
      skipLinkValidation: true,
    })

    expect(readFile).toHaveBeenNthCalledWith(1, '/repo/markee.yaml', 'utf8')
    expect(readFile).toHaveBeenNthCalledWith(2, '/repo/markee.yml', 'utf8')
    expect(global.config).toMatchObject({
      title: 'Docs',
      sources: [{ root: 'docs' }],
      build: {
        outDir: 'public-site',
        skipLinkValidation: true,
      },
      server: {
        host: '127.0.0.1',
        port: 9001,
      },
    })
    expect(ConfigCache.get()).toBe(global.config)
  })

  it('reuses the previous options when reloading and falls back to .markeerc', async () => {
    const readFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing yaml'))
      .mockRejectedValueOnce(new Error('missing yml'))
      .mockResolvedValueOnce('build:\n  outDir: generated\n')
      .mockRejectedValueOnce(new Error('missing yaml again'))
      .mockRejectedValueOnce(new Error('missing yml again'))
      .mockResolvedValueOnce('')

    const { ConfigCache } = await importConfigCache(readFile)

    await ConfigCache.loadConfig('/repo', {
      host: '',
      port: 8123,
      outDir: 'custom',
      skipLinkValidation: false,
    })
    await ConfigCache.loadConfig('/repo')

    expect(global.config.build.outDir).toBe('custom')
    expect(global.config.server.port).toBe(8123)
    expect(global.config.server.host).toBe('0.0.0.0')
    expect(global.config.sources).toEqual([])
  })

  it('filters private config fields, sanitizes roots, and resolves splits', async () => {
    const { ConfigCache } = await importConfigCache(vi.fn())

    global.config = {
      title: 'Docs',
      theme: 'ocean',
      sources: [{ root: './docs/' }],
      server: { host: '0.0.0.0', port: 8000 },
      build: {
        outDir: 'site',
        splits: {
          Admin: 'admin',
          Docs: '/docs',
        },
      },
      extensions: ['@markee/default'],
    } as any

    vi.stubEnv('MARKEE_SPLIT_ADMIN', 'admin-host')

    expect(ConfigCache.filterConfig()).toEqual({
      title: 'Docs',
      theme: 'ocean',
    })
    expect(ConfigCache.getRoot('./docs/')).toBe('docs')
    expect(ConfigCache.getRoot('/')).toBe('/')
    expect(ConfigCache.getSplits()).toEqual([
      { folder: '/admin', root: '/admin-host' },
      { folder: '/docs', root: '/_splits/docs' },
    ])
  })

  it('keeps defaults when no config file or options are available', async () => {
    const readFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing yaml'))
      .mockRejectedValueOnce(new Error('missing yml'))
      .mockRejectedValueOnce(new Error('missing rc'))

    const { ConfigCache } = await importConfigCache(readFile)

    await ConfigCache.loadConfig('/repo', undefined)

    expect(global.config).toMatchObject({
      sources: [],
      build: { outDir: 'site' },
      server: { host: '0.0.0.0', port: 8000 },
    })
    expect(ConfigCache.getRoot('')).toBe('')
    expect(ConfigCache.getSplits()).toEqual([])
  })
})
