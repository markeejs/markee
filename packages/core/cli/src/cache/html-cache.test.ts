import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleHelpers } from '../helpers/module.js'
let ConfigCache: typeof import('./config-cache.js').ConfigCache

async function importHtmlCache({
  readFile = vi.fn(),
  stat = vi.fn(),
  globby = vi.fn(),
  getFileTime = vi.fn(),
  loadExtensions = vi.fn(),
}: {
  readFile?: ReturnType<typeof vi.fn>
  stat?: ReturnType<typeof vi.fn>
  globby?: ReturnType<typeof vi.fn>
  getFileTime?: ReturnType<typeof vi.fn>
  loadExtensions?: ReturnType<typeof vi.fn>
} = {}) {
  vi.doMock('fs-extra', () => ({
    default: {
      readFile,
      stat,
    },
  }))
  vi.doMock('globby', () => ({
    globby,
  }))
  vi.doMock('./bust-cache.js', () => ({
    BustCache: {
      getFileTime,
    },
  }))
  vi.doMock('./extensions-cache.js', () => ({
    ExtensionsCache: {
      loadExtensions,
    },
  }))

  return {
    ...(await import('./html-cache.js')),
    mocks: { readFile, stat, globby, getFileTime, loadExtensions },
  }
}

describe('HtmlCache', () => {
  beforeEach(async () => {
    vi.resetModules()
    ;({ ConfigCache } =
      await vi.importActual<typeof import('./config-cache.js')>(
        './config-cache.js',
      ))
    ConfigCache.reset()
    ConfigCache.config = {
      title: 'Docs',
      build: { outDir: 'site' },
    } as any
    ConfigCache.command = 'build'
    ConfigCache.mode = 'production'
  })

  it('builds head fragments for the project and extensions with configurable inline limits', async () => {
    ConfigCache.config.build.inlineHeadAssets = {
      js: 8,
      css: 24,
    }
    ConfigCache.config.build.minify = true

    const headFiles = [
      'small.js',
      'large.js',
      'too-large.js',
      'import.js',
      '_ignored.js',
      'small.css',
      'large.css',
      'too-large.css',
      'import.css',
      'fragment.html',
    ]
    const readFile = vi.fn(async (file: string) => {
      if (file.endsWith('/_assets/_head.html')) {
        return '<meta name="main" />'
      }
      if (file.endsWith('/small.js')) {
        return 'console.log( "small" )'
      }
      if (file.endsWith('/large.js')) {
        return 'console.log( "large" )'
      }
      if (file.endsWith('/small.css')) {
        return '.small { color: red !important; }'
      }
      if (file.endsWith('/large.css')) {
        return '.large { color: blue !important; }'
      }
      if (file.endsWith('/import.js')) {
        return 'import "./dep.js"; console.log("imported")'
      }
      if (file.endsWith('/import.css')) {
        return '@import "./dep.css"; .imported { color: blue; }'
      }
      if (file.endsWith('/fragment.html')) {
        return '<meta name="partial" />'
      }
      if (file.endsWith('/index.html')) {
        return '<html><head><title>Markee</title></head></html>'
      }
      return ''
    })
    const stat = vi.fn(async (file: string) => {
      if (file.endsWith('/_assets/_head.html')) {
        return { mtimeMs: 123, size: 10 }
      }
      if (
        file.endsWith('/small.js') ||
        file.endsWith('/small.css') ||
        file.endsWith('/import.js') ||
        file.endsWith('/import.css')
      ) {
        return { mtimeMs: 123, size: 100 }
      }
      if (file.endsWith('/large.js')) {
        return { mtimeMs: 123, size: 5 * 1024 }
      }
      if (file.endsWith('/too-large.js')) {
        return { mtimeMs: 123, size: 9 * 1024 }
      }
      if (file.endsWith('/large.css')) {
        return { mtimeMs: 123, size: 17 * 1024 }
      }
      if (file.endsWith('/too-large.css')) {
        return { mtimeMs: 123, size: 25 * 1024 }
      }
      return { mtimeMs: 123, size: 10 }
    })
    const getFileTime = vi.fn().mockResolvedValue(999)
    const globby = vi.fn(async (_patterns: unknown, { cwd }: { cwd: string }) =>
      cwd.includes('/packages/extensions/default/') ? [] : headFiles,
    )
    const { HtmlCache } = await importHtmlCache({
      readFile,
      stat,
      globby,
      getFileTime,
      loadExtensions: vi.fn().mockReturnValue({
        '@markee/default': ModuleHelpers.resolve('@markee/default'),
      }),
    })

    const head = await HtmlCache.head()

    expect(head.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['fragment', 'script', 'style']),
    )
    expect(head.some((item) => item.html.includes('type="module"'))).toBe(true)
    expect(
      head.some((item) => item.html.includes('console.log("small");')),
    ).toBe(true)
    expect(
      head.some((item) => item.html.includes('console.log("large");')),
    ).toBe(true)
    expect(
      head.some((item) =>
        item.html.includes(
          '<script type="module" src="/_assets/_head/too-large.js"></script>',
        ),
      ),
    ).toBe(true)
    expect(
      head.some((item) =>
        item.html.includes(
          '<script type="module" src="/_assets/_head/import.js"></script>',
        ),
      ),
    ).toBe(true)
    expect(
      head.some((item) =>
        item.html.includes(
          '<style data-file="/_assets/_head/small.css">.small{color:red!important}',
        ),
      ),
    ).toBe(true)
    expect(head.some((item) => item.html.includes('rel="stylesheet"'))).toBe(
      true,
    )
    expect(
      head.some(
        (item) =>
          item.html.startsWith(
            '<style data-file="/_assets/_head/large.css">.large{color:',
          ) && item.html.includes('!important}'),
      ),
    ).toBe(true)
    expect(
      head.some((item) =>
        item.html.includes(
          '<link rel="stylesheet" href="/_assets/_head/too-large.css" />',
        ),
      ),
    ).toBe(true)
    expect(
      head.some((item) =>
        item.html.includes(
          '<link rel="stylesheet" href="/_assets/_head/import.css" />',
        ),
      ),
    ).toBe(true)
    expect(
      head.some((item) => item.html.includes('<meta name="partial" />')),
    ).toBe(true)
    expect(getFileTime).toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/too-large\.js$/),
    )
    expect(getFileTime).toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/import\.js$/),
    )
    expect(getFileTime).toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/too-large\.css$/),
    )
    expect(getFileTime).toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/import\.css$/),
    )
    expect(getFileTime).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/small\.js$/),
    )
    expect(getFileTime).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/large\.js$/),
    )
    expect(getFileTime).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/small\.css$/),
    )
    expect(getFileTime).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/_assets\/_head\/large\.css$/),
    )

    const index = await HtmlCache.index(true)
    expect(index).toContain('<title>Docs</title>')
    expect(index).toContain('</head>')
  })

  it('falls back to the built-in inline limits when object fields are omitted', async () => {
    ConfigCache.config.build.inlineHeadAssets = {
      js: 8,
    }

    const { HtmlCache } = await importHtmlCache({
      readFile: vi.fn(async (file: string) => {
        if (file.endsWith('/_assets/_head.html')) {
          throw new Error('missing')
        }
        if (file.endsWith('/large.js')) {
          return 'console.log("large")'
        }
        if (file.endsWith('/large.css')) {
          return '.large { color: blue; }'
        }
        return ''
      }),
      stat: vi.fn(async (file: string) => {
        if (file.endsWith('/large.js')) {
          return { mtimeMs: 123, size: 5 * 1024 }
        }
        if (file.endsWith('/large.css')) {
          return { mtimeMs: 123, size: 17 * 1024 }
        }
        return { mtimeMs: 123, size: 10 }
      }),
      globby: vi.fn().mockResolvedValue(['large.js', 'large.css']),
      getFileTime: vi.fn().mockResolvedValue(999),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const head = await HtmlCache.head()

    expect(head).toEqual([
      expect.objectContaining({
        kind: 'script',
        html: '<script data-file="/_assets/_head/large.js" type="module">console.log("large")</script>',
      }),
      expect.objectContaining({
        kind: 'style',
        html: '<link rel="stylesheet" href="/_assets/_head/large.css" />',
      }),
    ])
  })

  it('uses the built-in inline limits when enabled as a boolean', async () => {
    ConfigCache.config.build.inlineHeadAssets = true
    ConfigCache.config.build.minify = true

    const { HtmlCache } = await importHtmlCache({
      readFile: vi.fn(async (file: string) => {
        if (file.endsWith('/_assets/_head.html')) {
          throw new Error('missing')
        }
        if (file.endsWith('/small.js')) {
          return 'console.log("small")'
        }
        if (file.endsWith('/small.css')) {
          return '.small { color: red; }'
        }
        return ''
      }),
      stat: vi.fn(async (file: string) => {
        if (file.endsWith('/small.js') || file.endsWith('/small.css')) {
          return { mtimeMs: 123, size: 100 }
        }
        if (file.endsWith('/large.js')) {
          return { mtimeMs: 123, size: 5 * 1024 }
        }
        if (file.endsWith('/large.css')) {
          return { mtimeMs: 123, size: 17 * 1024 }
        }
        return { mtimeMs: 123, size: 10 }
      }),
      globby: vi
        .fn()
        .mockResolvedValue(['small.js', 'large.js', 'small.css', 'large.css']),
      getFileTime: vi.fn().mockResolvedValue(999),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const head = await HtmlCache.head()

    expect(head).toHaveLength(4)
    expect(
      head.some(
        (item) =>
          item.kind === 'script' &&
          item.html.startsWith(
            '<script data-file="/_assets/_head/small.js" type="module">',
          ) &&
          item.html.includes('console.log("small")'),
      ),
    ).toBe(true)
    expect(
      head.some(
        (item) =>
          item.kind === 'script' &&
          item.html ===
            '<script type="module" src="/_assets/_head/large.js"></script>',
      ),
    ).toBe(true)
    expect(
      head.some(
        (item) =>
          item.kind === 'style' &&
          item.html.startsWith(
            '<style data-file="/_assets/_head/small.css">.small{color:red}',
          ),
      ),
    ).toBe(true)
    expect(
      head.some(
        (item) =>
          item.kind === 'style' &&
          item.html ===
            '<link rel="stylesheet" href="/_assets/_head/large.css" />',
      ),
    ).toBe(true)
  })

  it('keeps small head scripts and styles external by default during build', async () => {
    const { HtmlCache } = await importHtmlCache({
      readFile: vi.fn(async (file: string) => {
        if (file.endsWith('/_assets/_head.html')) {
          throw new Error('missing')
        }
        return ''
      }),
      stat: vi.fn(async () => ({ mtimeMs: 123, size: 100 })),
      globby: vi.fn().mockResolvedValue(['small.js', 'small.css']),
      getFileTime: vi.fn().mockResolvedValue(999),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const head = await HtmlCache.head()

    expect(head).toEqual([
      expect.objectContaining({
        kind: 'script',
        html: '<script type="module" src="/_assets/_head/small.js"></script>',
      }),
      expect.objectContaining({
        kind: 'style',
        html: '<link rel="stylesheet" href="/_assets/_head/small.css" />',
      }),
    ])
  })

  it('uses the development client script when head injection is disabled', async () => {
    ConfigCache.command = 'develop'

    const { HtmlCache } = await importHtmlCache({
      readFile: vi
        .fn()
        .mockResolvedValue(
          '<html><head><title>Markee</title><script src="/assets/app-123.js"></script></head></html>',
        ),
      stat: vi.fn(),
      globby: vi.fn().mockResolvedValue([]),
      getFileTime: vi.fn(),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const index = await HtmlCache.index(false)
    expect(index).toContain('src="/assets/development.js"')
    expect(index).toContain('<title>Docs</title>')
  })

  it('keeps head scripts and styles external in development even when they are small', async () => {
    ConfigCache.command = 'develop'

    const { HtmlCache } = await importHtmlCache({
      readFile: vi.fn(async (file: string) => {
        if (file.endsWith('/_assets/_head.html')) {
          throw new Error('missing')
        }
        return ''
      }),
      stat: vi.fn(async () => ({ mtimeMs: 123, size: 100 })),
      globby: vi.fn().mockResolvedValue(['small.js', 'small.css']),
      getFileTime: vi.fn().mockResolvedValue(999),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const head = await HtmlCache.head()

    expect(head).toEqual([
      expect.objectContaining({
        kind: 'script',
        html: '<script type="module" src="/_assets/_head/small.js"></script>',
      }),
      expect.objectContaining({
        kind: 'style',
        html: '<link rel="stylesheet" href="/_assets/_head/small.css" />',
      }),
    ])
  })

  it('falls back when the main head file or fragment files are missing', async () => {
    const { HtmlCache } = await importHtmlCache({
      readFile: vi.fn(async (file: string) => {
        if (file.endsWith('/fragment.html')) {
          throw new Error('missing fragment')
        }
        if (file.endsWith('/index.html')) {
          return '<html><head><title>Markee</title></head></html>'
        }
        throw new Error('missing')
      }),
      stat: vi.fn(async () => ({ mtimeMs: 123 })),
      globby: vi.fn().mockResolvedValue(['fragment.html']),
      getFileTime: vi.fn(),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const head = await HtmlCache.head()
    expect(head).toEqual([
      expect.objectContaining({
        kind: 'fragment',
        html: expect.stringContaining('Error loading file'),
      }),
    ])
  })

  it('falls back to the default title when config.title is empty', async () => {
    ConfigCache.config = { title: '' } as any

    const { HtmlCache } = await importHtmlCache({
      readFile: vi
        .fn()
        .mockResolvedValue('<html><head><title>Markee</title></head></html>'),
      stat: vi.fn(),
      globby: vi.fn().mockResolvedValue([]),
      getFileTime: vi.fn(),
      loadExtensions: vi.fn().mockReturnValue({}),
    })

    const index = await HtmlCache.index(false)
    expect(index).toContain('<title>Markee</title>')
  })
})
