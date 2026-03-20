import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleHelpers } from '../helpers/module.js'

async function importExtensionsCache({
  readFileSync = vi.fn(),
  existsSync = vi.fn(),
  readdirSync = vi.fn(),
  pathExists = vi.fn(),
  parse = vi.fn(),
}: {
  readFileSync?: ReturnType<typeof vi.fn>
  existsSync?: ReturnType<typeof vi.fn>
  readdirSync?: ReturnType<typeof vi.fn>
  pathExists?: ReturnType<typeof vi.fn>
  parse?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  vi.doMock('fs-extra', () => ({
    default: {
      readFileSync,
      existsSync,
      readdirSync,
      pathExists,
    },
  }))
  vi.doMock('yaml', () => ({
    default: {
      parse,
    },
  }))

  return {
    ...(await import('./extensions-cache.js')),
    mocks: { readFileSync, existsSync, readdirSync, pathExists, parse },
  }
}

describe('ExtensionsCache', () => {
  beforeEach(() => {
    global.config = {
      extensions: ['@markee/default', '@markee/missing'],
    } as any
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads extensions, expands nested dependencies, and reports missing ones', async () => {
    const parse = vi
      .fn()
      .mockReturnValueOnce({ extensions: ['@markee/default'] })
      .mockReturnValue({})

    const { ExtensionsCache, mocks } = await importExtensionsCache({
      readFileSync: vi.fn().mockReturnValue('extensions: []'),
      parse,
    })

    const extensions = ExtensionsCache.loadExtensions()

    expect(extensions).toHaveProperty('@markee/default')
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('@markee/missing'),
      expect.any(String),
    )

    expect(ExtensionsCache.loadExtensions()).toBe(extensions)
    expect(mocks.readFileSync).toHaveBeenCalled()
  })

  it('logs parse errors while expanding nested extension dependencies', async () => {
    const { ExtensionsCache } = await importExtensionsCache({
      readFileSync: vi.fn().mockReturnValue('extensions: []'),
      parse: vi.fn().mockImplementationOnce(() => {
        throw new Error('bad yaml')
      }),
    })

    ExtensionsCache.loadExtensions()

    expect(console.error).toHaveBeenNthCalledWith(
      1,
      'Error parsing',
      expect.stringContaining('/packages/extensions/default/extension.yaml'),
    )
    expect(console.error).toHaveBeenNthCalledWith(2, expect.any(Error))
  })

  it('loads extension configs and ignores broken YAML files', async () => {
    const { ExtensionsCache } = await importExtensionsCache()

    ExtensionsCache.extensions = {
      '@markee/default': ModuleHelpers.resolve('@markee/default'),
    }

    const readFileSync = vi
      .spyOn((await import('fs-extra')).default, 'readFileSync')
      .mockReturnValue('flatten:\n  - docs\n')
    const parse = vi
      .spyOn((await import('yaml')).default, 'parse')
      .mockReturnValueOnce({ flatten: ['docs'] })
      .mockImplementationOnce(() => {
        throw new Error('bad yaml')
      })

    const content = ExtensionsCache.loadExtensionsContent()
    expect(content['@markee/default']?.flatten).toEqual(['docs'])

    ExtensionsCache.content = undefined
    ExtensionsCache.extensions = {
      '@markee/default': ModuleHelpers.resolve('@markee/default'),
      '@markee/default/other': ModuleHelpers.resolve('@markee/default'),
    }
    ExtensionsCache.loadExtensionsContent()

    expect(console.error).toHaveBeenCalled()
    readFileSync.mockRestore()
    parse.mockRestore()
  })

  it('resolves extension files and build-time scripts from matching extensions', async () => {
    const { ExtensionsCache, mocks } = await importExtensionsCache({
      pathExists: vi.fn().mockResolvedValue(true),
      existsSync: vi
        .fn()
        .mockImplementation((file: string) => file.endsWith('/_assets/_build')),
      readdirSync: vi
        .fn()
        .mockReturnValue(['a.js', '_ignore.js', 'b.mjs', 'c.css']),
    })

    ExtensionsCache.content = {
      '@markee/default': {
        file: ModuleHelpers.resolve('@markee/default'),
        flatten: ['docs'],
      },
    }

    await expect(
      ExtensionsCache.getExtensionFile('/docs/example.txt'),
    ).resolves.toContain('/docs/example.txt')
    await expect(
      ExtensionsCache.getExtensionFile('/missing/example.txt'),
    ).resolves.toBeUndefined()

    const buildTime = ExtensionsCache.getBuildTimeExtensions()
    expect(buildTime).toHaveLength(4)
    expect(
      buildTime.every((file) => file.endsWith('.js') || file.endsWith('.mjs')),
    ).toBe(true)
    expect(ExtensionsCache.hasBuildTimeExtensions()).toBe(true)

    ExtensionsCache.clearAll()
    expect(ExtensionsCache.extensions).toBeUndefined()
    expect(ExtensionsCache.content).toBeUndefined()
    expect(ExtensionsCache.buildTime).toBeUndefined()
    expect(mocks.readdirSync).toHaveBeenCalled()
  })

  it('ignores extension lookup failures and empty build folders', async () => {
    const { ExtensionsCache } = await importExtensionsCache({
      pathExists: vi.fn().mockResolvedValue(false),
      existsSync: vi.fn().mockReturnValue(false),
    })

    ExtensionsCache.content = {
      '@markee/default': {
        file: ModuleHelpers.resolve('@markee/default'),
        flatten: ['docs'],
      },
      '@markee/broken': {
        file: ModuleHelpers.resolve('@markee/default'),
        flatten: ['docs'],
      },
    }

    const realResolve = ModuleHelpers.resolve
    vi.spyOn(ModuleHelpers, 'resolve').mockImplementation(
      (specifier: string) => {
        if (specifier === '@markee/broken') throw new Error('missing')
        return realResolve(specifier)
      },
    )

    await expect(
      ExtensionsCache.getExtensionFile('/docs/missing.txt'),
    ).resolves.toBeUndefined()
    expect(ExtensionsCache.getBuildTimeExtensions()).toEqual([])
    expect(ExtensionsCache.hasBuildTimeExtensions()).toBe(false)
  })

  it('handles missing configured extensions and blank yaml files', async () => {
    global.config = {} as any

    const { ExtensionsCache, mocks } = await importExtensionsCache({
      readFileSync: vi.fn().mockReturnValue(''),
      parse: vi.fn().mockReturnValue({}),
    })

    const extensions = ExtensionsCache.loadExtensions()
    expect(extensions).toEqual({
      '@markee/default': ModuleHelpers.resolve('@markee/default'),
    })

    const content = ExtensionsCache.loadExtensionsContent()
    expect(content).toEqual({
      '@markee/default': {
        file: ModuleHelpers.resolve('@markee/default'),
      },
    })
    expect(mocks.parse).toHaveBeenCalledWith('{}')
  })

  it('treats blank extension manifests as empty objects during dependency expansion', async () => {
    global.config = {
      extensions: ['@markee/default'],
    } as any

    const { ExtensionsCache, mocks } = await importExtensionsCache({
      readFileSync: vi.fn().mockReturnValue('   '),
      parse: vi.fn().mockReturnValue({}),
    })

    ExtensionsCache.loadExtensions()

    expect(mocks.parse).toHaveBeenCalledWith('{}')
  })
})
