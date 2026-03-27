import { describe, expect, it, vi } from 'vitest'

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  ...fsMocks,
  default: fsMocks,
}))

import {
  inlineHeadAssets,
  pluginInlineHeadAssets,
} from './plugin-inline-head-assets.js'

function getWriteBundle(plugin: ReturnType<typeof pluginInlineHeadAssets>) {
  if (!plugin.writeBundle) {
    throw new Error('plugin is missing writeBundle')
  }

  return plugin.writeBundle
}

describe('pluginInlineHeadAssets', () => {
  it('inlines small head scripts and styles without import statements and reports their emitted files', () => {
    const { html, inlinedFiles } = inlineHeadAssets(
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <script type="module" crossorigin src="/assets/app.js"></script>',
        '    <link rel="stylesheet" crossorigin href="/assets/app.css">',
        '    <link rel="stylesheet" href="/assets/bin.css">',
        '  </head>',
        '</html>',
      ].join('\n'),
      {
        'assets/app.js': {
          type: 'chunk',
          fileName: 'assets/app.js',
          code: 'console.log("app")',
        },
        'assets/app.css': {
          type: 'asset',
          fileName: 'assets/app.css',
          source: '.app{color:red!important}',
        },
        'assets/bin.css': {
          type: 'asset',
          fileName: 'assets/bin.css',
          source: new TextEncoder().encode('.bin{color:blue}'),
        },
      },
    )

    expect(html).toContain('<script type="module">console.log("app")</script>')
    expect(html).toContain('<style>.app{color:red!important}</style>')
    expect(html).toContain('<style>.bin{color:blue}</style>')
    expect(inlinedFiles).toEqual([
      'assets/app.js',
      'assets/app.css',
      'assets/bin.css',
    ])
  })

  it('keeps large head assets external', () => {
    const { html, inlinedFiles } = inlineHeadAssets(
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <script type="module" src="/assets/app.js"></script>',
        '    <link rel="stylesheet" href="/assets/app.css">',
        '  </head>',
        '</html>',
      ].join('\n'),
      {
        'assets/app.js': {
          type: 'chunk',
          fileName: 'assets/app.js',
          code: 'a'.repeat(101 * 1024),
        },
        'assets/app.css': {
          type: 'asset',
          fileName: 'assets/app.css',
          source: 'a'.repeat(101 * 1024),
        },
      },
    )

    expect(html).toContain(
      '<script type="module" src="/assets/app.js"></script>',
    )
    expect(html).toContain('<link rel="stylesheet" href="/assets/app.css">')
    expect(inlinedFiles).toEqual([])
  })

  it('keeps small head assets external when they contain the word import', () => {
    const { html, inlinedFiles } = inlineHeadAssets(
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <script type="module" src="/assets/app.js"></script>',
        '    <link rel="stylesheet" href="/assets/app.css">',
        '  </head>',
        '</html>',
      ].join('\n'),
      {
        'assets/app.js': {
          type: 'chunk',
          fileName: 'assets/app.js',
          code: 'import"./dep.js";console.log("app")',
        },
        'assets/app.css': {
          type: 'asset',
          fileName: 'assets/app.css',
          source: '@import "/assets/theme.css";.app{color:red}',
        },
      },
    )

    expect(html).toContain(
      '<script type="module" src="/assets/app.js"></script>',
    )
    expect(html).toContain('<link rel="stylesheet" href="/assets/app.css">')
    expect(inlinedFiles).toEqual([])
  })

  it('ignores non-module scripts, non-stylesheet links, missing entries, invalid entries, and html without a head', () => {
    const withoutHead = inlineHeadAssets('<html><body></body></html>', {})
    const { html, inlinedFiles } = inlineHeadAssets(
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <script src="/assets/legacy.js"></script>',
        '    <link rel="icon" href="/favicon.svg">',
        '    <script type="module" src="/assets/missing.js"></script>',
        '    <link rel="stylesheet" href="assets/relative.css">',
        '    <link rel="stylesheet" href="/assets/invalid.css">',
        '  </head>',
        '</html>',
      ].join('\n'),
      {
        'assets/legacy.js': {
          type: 'chunk',
          fileName: 'assets/legacy.js',
          code: 'console.log("legacy")',
        },
        'assets/invalid.css': {
          type: 'other',
        } as any,
      },
    )

    expect(withoutHead).toEqual({
      html: '<html><body></body></html>',
      inlinedFiles: [],
    })
    expect(html).toContain('<script src="/assets/legacy.js"></script>')
    expect(html).toContain('<link rel="icon" href="/favicon.svg">')
    expect(html).toContain(
      '<script type="module" src="/assets/missing.js"></script>',
    )
    expect(html).toContain('<link rel="stylesheet" href="assets/relative.css">')
    expect(html).toContain('<link rel="stylesheet" href="/assets/invalid.css">')
    expect(inlinedFiles).toEqual([])
  })

  it('writes the transformed html and removes inlined files from disk', async () => {
    fsMocks.readFile.mockReset()
    fsMocks.writeFile.mockReset()
    fsMocks.rm.mockReset()
    fsMocks.readFile.mockResolvedValue(
      '<html><head><script type="module" src="/assets/app.js"></script></head></html>',
    )

    const plugin = pluginInlineHeadAssets()
    const writeBundle = getWriteBundle(plugin)

    await writeBundle.call(
      {} as any,
      { dir: 'dist' } as any,
      {
        'assets/app.js': {
          type: 'chunk',
          fileName: 'assets/app.js',
          code: 'console.log("app")',
        },
      } as any,
    )

    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/dist\/index\.html$/),
      '<html><head><script type="module">console.log("app")</script></head></html>',
      'utf8',
    )
    expect(fsMocks.rm).toHaveBeenCalledWith(
      expect.stringMatching(/dist\/assets\/app\.js$/),
      { force: true },
    )
  })

  it('does nothing when the written index file is missing or unchanged', async () => {
    fsMocks.readFile.mockReset()
    fsMocks.writeFile.mockReset()
    fsMocks.rm.mockReset()

    const plugin = pluginInlineHeadAssets()
    const writeBundle = getWriteBundle(plugin)

    fsMocks.readFile.mockRejectedValueOnce(new Error('missing'))
    await writeBundle.call({} as any, { dir: 'dist' } as any, {} as any)

    fsMocks.readFile.mockResolvedValueOnce('<html><head></head></html>')
    await writeBundle.call({} as any, { dir: 'dist' } as any, {} as any)

    expect(fsMocks.writeFile).not.toHaveBeenCalled()
    expect(fsMocks.rm).not.toHaveBeenCalled()
  })

  it('falls back to dist when the output directory is not provided', async () => {
    fsMocks.readFile.mockReset()
    fsMocks.writeFile.mockReset()
    fsMocks.rm.mockReset()
    fsMocks.readFile.mockResolvedValue(
      '<html><head><link rel="stylesheet" href="/assets/app.css"></head></html>',
    )

    const plugin = pluginInlineHeadAssets()
    const writeBundle = getWriteBundle(plugin)

    await writeBundle.call(
      {} as any,
      {} as any,
      {
        'assets/app.css': {
          type: 'asset',
          fileName: 'assets/app.css',
          source: '.app{color:red}',
        },
      } as any,
    )

    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/dist\/index\.html$/),
      '<html><head><style>.app{color:red}</style></head></html>',
      'utf8',
    )
    expect(fsMocks.rm).toHaveBeenCalledWith(
      expect.stringMatching(/dist\/assets\/app\.css$/),
      { force: true },
    )
  })
})
