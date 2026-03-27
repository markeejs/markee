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
        'title: Docs\nbuild:\n  outDir: dist\n  inlineHeadAssets:\n    js: 8\n    css: 24\n  minify:\n    js: true\nserver:\n  port: 7000\nsources:\n  - root: docs\n',
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
    expect(ConfigCache.config).toMatchObject({
      title: 'Docs',
      sources: [{ root: 'docs' }],
      build: {
        outDir: 'public-site',
        inlineHeadAssets: {
          js: 8,
          css: 24,
        },
        minify: {
          js: true,
        },
        skipLinkValidation: true,
      },
      server: {
        host: '127.0.0.1',
        port: 9001,
      },
    })
    expect(ConfigCache.get()).toBe(ConfigCache.config)
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

    expect(ConfigCache.config.build.outDir).toBe('custom')
    expect(ConfigCache.config.server.port).toBe(8123)
    expect(ConfigCache.config.server.host).toBe('0.0.0.0')
    expect(ConfigCache.config.sources).toEqual([])
  })

  it('stores config, mode, and command locally and resets them', async () => {
    const { ConfigCache } = await importConfigCache(vi.fn())

    ConfigCache.config = {
      title: 'Docs',
      sources: [{ root: './docs/' }],
      server: { host: '0.0.0.0', port: 8000 },
      build: { outDir: 'site' },
    } as any
    ConfigCache.mode = 'preview'
    ConfigCache.command = 'develop'

    expect(ConfigCache.get()).toMatchObject({
      title: 'Docs',
      sources: [{ root: './docs/' }],
    })
    expect(ConfigCache.mode).toBe('preview')
    expect(ConfigCache.command).toBe('develop')

    ConfigCache.reset()

    expect(() => ConfigCache.get()).toThrow(
      'Markee CLI config accessed before initialization',
    )
    expect(() => ConfigCache.mode).toThrow(
      'Markee CLI mode accessed before initialization',
    )
    expect(() => ConfigCache.command).toThrow(
      'Markee CLI command accessed before initialization',
    )
  })

  it('filters private config fields, sanitizes roots, and resolves splits', async () => {
    const { ConfigCache } = await importConfigCache(vi.fn())

    ConfigCache.config = {
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

    expect(ConfigCache.config).toMatchObject({
      sources: [],
      build: { outDir: 'site' },
      server: { host: '0.0.0.0', port: 8000 },
    })
    expect(ConfigCache.getRoot('')).toBe('')
    expect(ConfigCache.getSplits()).toEqual([])
  })
})
