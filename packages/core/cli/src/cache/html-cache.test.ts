import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleHelpers } from '../helpers/module.js'

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
  vi.resetModules()

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
  beforeEach(() => {
    global.config = {
      title: 'Docs',
    } as any
  })

  it('builds head fragments for the project and extensions', async () => {
    const headFiles = ['head.js', '_ignored.js', 'head.css', 'fragment.html']
    const readFile = vi.fn(async (file: string) => {
      if (file.endsWith('/_assets/_head.html')) {
        return '<meta name="main" />'
      }
      if (file.endsWith('/fragment.html')) {
        return '<meta name="partial" />'
      }
      if (file.endsWith('/index.html')) {
        return '<html><head><title>Markee</title></head></html>'
      }
      return ''
    })
    const stat = vi.fn().mockResolvedValue({ mtimeMs: 123 })
    const globby = vi.fn(async (_patterns: unknown, { cwd }: { cwd: string }) =>
      cwd.includes('/packages/extensions/default/') ? [] : headFiles,
    )
    const { HtmlCache } = await importHtmlCache({
      readFile,
      stat,
      globby,
      getFileTime: vi.fn().mockResolvedValue(999),
      loadExtensions: vi.fn().mockReturnValue({
        '@markee/default': ModuleHelpers.resolve('@markee/default'),
      }),
    })

    const head = await HtmlCache.head()

    expect(head.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['fragment', 'script', 'style']),
    )
    expect(head.some((item) => item.html.includes('type="module"'))).toBe(true)
    expect(head.some((item) => item.html.includes('rel="stylesheet"'))).toBe(
      true,
    )
    expect(
      head.some((item) => item.html.includes('<meta name="partial" />')),
    ).toBe(true)

    const index = await HtmlCache.index(true)
    expect(index).toContain('<title>Docs</title>')
    expect(index).toContain('</head>')
  })

  it('uses the development client script when head injection is disabled', async () => {
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
    global.config = { title: '' } as any

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
