import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importBuildMinify({
  esbuildTransform,
  lightningTransform,
  rootDir = '/Users/jvandersande/Worskspaces/Perso/markee/packages/core/cli',
}: {
  esbuildTransform?: ReturnType<typeof vi.fn>
  lightningTransform?: ReturnType<typeof vi.fn>
  rootDir?: string
} = {}) {
  vi.resetModules()

  if (esbuildTransform) {
    vi.doMock('esbuild', () => ({
      transform: esbuildTransform,
    }))
  }
  if (lightningTransform) {
    vi.doMock('lightningcss', () => ({
      transform: lightningTransform,
    }))
  }
  vi.doMock('../constants.js', async () => {
    const actual = await vi.importActual('../constants.js')
    return {
      ...actual,
      ROOT_DIR: rootDir,
    }
  })

  const { ConfigCache } = await vi.importActual<
    typeof import('../cache/config-cache.js')
  >('../cache/config-cache.js')

  return {
    ...(await import('./build-minify.js')),
    ConfigCache,
  }
}

describe('BuildMinifyHelpers', () => {
  beforeEach(async () => {
    vi.unmock('esbuild')
    vi.unmock('lightningcss')
  })

  it('minifies JS and CSS content when enabled globally', async () => {
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify()
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [],
    } as any

    const js = await BuildMinifyHelpers.minifyContent(
      '/repo/site/file.js',
      'function test () { console.log(1 + 2) }',
    )
    const css = await BuildMinifyHelpers.minifyContent(
      '/repo/site/file.css',
      'body { color: red; }',
    )

    expect(BuildMinifyHelpers.enabled('js')).toBe(true)
    expect(BuildMinifyHelpers.enabled('css')).toBe(true)
    expect(js.trim()).toBe('function test(){console.log(3)}')
    expect(css.trim()).toBe('body{color:red}')
  })

  it('respects per-type configuration and ignores pre-minified or unsupported files', async () => {
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify()
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: { js: true } },
      sources: [],
    } as any

    expect(BuildMinifyHelpers.enabled('js')).toBe(true)
    expect(BuildMinifyHelpers.enabled('css')).toBe(false)
    expect(
      await BuildMinifyHelpers.minifyContent(
        '/repo/site/file.css',
        'body { color: red; }',
      ),
    ).toBe('body { color: red; }')
    expect(
      await BuildMinifyHelpers.minifyContent(
        '/repo/site/file.min.js',
        'function test () { console.log(1) }',
      ),
    ).toBe('function test () { console.log(1) }')
    expect(
      await BuildMinifyHelpers.minifyContent(
        '/repo/site/file.min.css',
        'body { color: red; }',
      ),
    ).toBe('body { color: red; }')
    expect(
      await BuildMinifyHelpers.minifyContent(
        '/repo/site/file.txt',
        'plain text',
      ),
    ).toBe('plain text')
  })

  it('logs and falls back to the original content when minification fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify({
      esbuildTransform: vi.fn().mockRejectedValue(new Error('boom')),
    })
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [],
    } as any
    const source = 'function test () { console.log(1) }'

    expect(
      await BuildMinifyHelpers.minifyContent('/repo/site/file.js', source),
    ).toBe(source)
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Skipping JS minification'),
    )
  })

  it('falls back when the CSS minifier throws a non-Error value', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify({
      lightningTransform: vi.fn(() => {
        throw 'boom'
      }),
    })
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [],
    } as any
    const source = 'body { color: red; }'

    expect(
      await BuildMinifyHelpers.minifyContent('/repo/site/file.css', source),
    ).toBe(source)
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Skipping CSS minification'),
    )
  })

  it('runs CSS through lightningcss and then esbuild for a second pass', async () => {
    const lightningTransform = vi.fn(() => ({
      code: Buffer.from('body { color: red; margin: 0 0 0 0; }'),
    }))
    const esbuildTransform = vi.fn(async (_source: string, options: any) => ({
      code:
        options.loader === 'css'
          ? 'body{color:red;margin:0}'
          : 'function test(){return 1}',
    }))
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify({
      esbuildTransform,
      lightningTransform,
    })
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [],
    } as any

    expect(
      await BuildMinifyHelpers.minifyContent(
        '/repo/site/file.css',
        'body { color: red; margin: 0 0 0 0; }',
      ),
    ).toBe('body{color:red;margin:0}')
    expect(lightningTransform).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: '/repo/site/file.css',
        minify: true,
      }),
    )
    expect(esbuildTransform).toHaveBeenCalledWith(
      'body { color: red; margin: 0 0 0 0; }',
      expect.objectContaining({
        loader: 'css',
        minify: true,
        sourcefile: '/repo/site/file.css',
      }),
    )
  })

  it('falls back when the CSS second pass throws', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify({
      lightningTransform: vi.fn(() => ({
        code: Buffer.from('body { color: red; }'),
      })),
      esbuildTransform: vi.fn(async (_source: string, options: any) => {
        if (options.loader === 'css') {
          throw new Error('boom')
        }

        return { code: 'function test(){return 1}' }
      }),
    })
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [],
    } as any
    const source = 'body { color: red; }'

    expect(
      await BuildMinifyHelpers.minifyContent('/repo/site/file.css', source),
    ).toBe(source)
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Skipping CSS minification'),
    )
  })

  it('logs the full file path when the relative path is empty', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const filePath = '/repo/site/file.js'
    const { BuildMinifyHelpers, ConfigCache } = await importBuildMinify({
      esbuildTransform: vi.fn().mockRejectedValue(new Error('boom')),
      rootDir: filePath,
    })
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [],
    } as any

    await BuildMinifyHelpers.minifyContent(
      filePath,
      'function test(){return 1}',
    )

    expect(log).toHaveBeenCalledWith(expect.stringContaining(filePath))
  })
})
