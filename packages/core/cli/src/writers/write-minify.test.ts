import { beforeEach, describe, expect, it, vi } from 'vitest'
let ConfigCache: typeof import('../cache/config-cache.js').ConfigCache

async function importWriteMinify({
  pathExists = vi.fn(),
  readFile = vi.fn(),
  writeFile = vi.fn(),
  globby = vi.fn(),
  enabled = vi.fn(),
  minifyContent = vi.fn(),
}: {
  pathExists?: ReturnType<typeof vi.fn>
  readFile?: ReturnType<typeof vi.fn>
  writeFile?: ReturnType<typeof vi.fn>
  globby?: ReturnType<typeof vi.fn>
  enabled?: ReturnType<typeof vi.fn>
  minifyContent?: ReturnType<typeof vi.fn>
} = {}) {
  vi.doMock('fs-extra', () => ({
    default: {
      pathExists,
      readFile,
      writeFile,
    },
  }))
  vi.doMock('globby', () => ({
    globby,
  }))
  vi.doMock('../constants.js', async () => {
    const actual = await vi.importActual('../constants.js')
    return {
      ...actual,
      ROOT_DIR: '/repo',
    }
  })
  vi.doMock('../helpers/build-minify.js', () => ({
    BuildMinifyHelpers: {
      enabled,
      minifyContent,
    },
  }))

  return {
    ...(await import('./write-minify.js')),
    pathExists,
    readFile,
    writeFile,
    globby,
    enabled,
    minifyContent,
  }
}

describe('writeMinify', () => {
  beforeEach(async () => {
    vi.resetModules()
    ;({ ConfigCache } = await vi.importActual<
      typeof import('../cache/config-cache.js')
    >('../cache/config-cache.js'))
    ConfigCache.reset()
    ConfigCache.config = {
      build: { outDir: 'site', minify: true },
      sources: [{ root: 'docs' }, { root: '/blog' }],
    } as any
  })

  it('does nothing when JS and CSS minification are both disabled', async () => {
    const { writeMinify, pathExists, globby, readFile, writeFile } =
      await importWriteMinify({
        enabled: vi.fn().mockReturnValue(false),
      })

    await writeMinify()

    expect(pathExists).not.toHaveBeenCalled()
    expect(globby).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('minifies matching files copied _assets', async () => {
    const { writeMinify, pathExists, writeFile, minifyContent } =
      await importWriteMinify({
        pathExists: vi.fn(async (path: string) =>
          ['/repo/public', '/repo/site/_assets', '/repo/site/docs'].includes(
            path,
          ),
        ),
        globby: vi.fn(async (_patterns: unknown, options: { cwd: string }) => {
          if (options.cwd === '/repo/public') {
            return ['public.js', 'nested/public.css']
          }
          if (options.cwd === '/repo/site/_assets') {
            return [
              '/repo/site/_assets/head.js',
              '/repo/site/_assets/theme.css',
            ]
          }
          if (options.cwd === '/repo/site/docs') {
            return ['/repo/site/docs/embed.js', '/repo/site/docs/keep.css']
          }
          return []
        }),
        readFile: vi.fn(async (file: string) => {
          if (file.endsWith('public.js'))
            return 'function publicFile () { return 1 }'
          if (file.endsWith('public.css')) return 'body { color: red; }'
          if (file.endsWith('head.js')) return 'function head () { return 2 }'
          if (file.endsWith('theme.css')) return 'main { color: blue; }'
          if (file.endsWith('embed.js')) return 'function embed () { return 3 }'
          return '.keep { color: green; }'
        }),
        writeFile: vi.fn().mockResolvedValue(undefined),
        enabled: vi.fn().mockReturnValue(true),
        minifyContent: vi.fn(async (file: string, source: string) =>
          file.endsWith('keep.css') ? source : `min:${source}`,
        ),
      })

    await writeMinify()

    expect(pathExists).toHaveBeenCalledWith('/repo/site/_assets')
    expect(minifyContent).not.toHaveBeenCalledWith(
      '/repo/site/public.js',
      'function publicFile () { return 1 }',
    )
    expect(minifyContent).not.toHaveBeenCalledWith(
      '/repo/site/nested/public.css',
      'body { color: red; }',
    )
    expect(minifyContent).toHaveBeenCalledWith(
      '/repo/site/_assets/head.js',
      'function head () { return 2 }',
    )
    expect(writeFile).not.toHaveBeenCalledWith(
      '/repo/site/public.js',
      'min:function publicFile () { return 1 }',
      'utf8',
    )
    expect(writeFile).not.toHaveBeenCalledWith(
      '/repo/site/nested/public.css',
      'min:body { color: red; }',
      'utf8',
    )
    expect(writeFile).toHaveBeenCalledWith(
      '/repo/site/_assets/head.js',
      'min:function head () { return 2 }',
      'utf8',
    )
    expect(writeFile).toHaveBeenCalledWith(
      '/repo/site/_assets/theme.css',
      'min:main { color: blue; }',
      'utf8',
    )
  })

  it('supports minifying only one asset type', async () => {
    const enabled = vi.fn().mockImplementation((kind: string) => kind === 'css')
    const { writeMinify, globby } = await importWriteMinify({
      enabled,
    })

    await writeMinify()

    expect(enabled).toHaveBeenCalledWith('js')
    expect(enabled).toHaveBeenCalledWith('css')
    expect(globby).not.toHaveBeenCalledWith(
      expect.arrayContaining(['**/*.js', '**/*.mjs']),
      expect.anything(),
    )
  })
})
