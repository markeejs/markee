import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

import { pluginExposeDependency } from './plugin-expose-dependency.js'

function getHook(hook: any) {
  return typeof hook === 'function' ? hook : hook.handler
}

describe('pluginExposeDependency', () => {
  it('maps matching chunk names into assets paths', () => {
    expect(pluginExposeDependency.chunk('lit', 'lit/index.js')).toBe(
      'assets/lit/index.js',
    )
    expect(pluginExposeDependency.chunk('lit', 'other/index.js')).toBeNull()
  })

  it('builds virtual export chunks for packages with explicit exports', () => {
    const plugin = pluginExposeDependency('lit')
    const emitFile = vi.fn()
    const buildStart = getHook(plugin.buildStart!)
    const resolveId = getHook(plugin.resolveId!)
    const load = getHook(plugin.load!)

    buildStart.call({ emitFile } as any, {} as any)

    expect(plugin.name).toBe('expose-pkg-exports-for-importmap')
    expect(plugin.apply).toBe('build')
    expect(
      resolveId('virtual:importmap-export:lit/index.js', undefined, {} as any),
    ).toBe('\0virtual:importmap-export:lit/index.js')
    expect(resolveId('other', undefined, {} as any)).toBeNull()
    expect(load('\0virtual:importmap-export:lit/index.js', {} as any)).toBe(
      'export * from "lit";\n',
    )
    expect(
      load('\0virtual:importmap-export:lit/decorators.js', {} as any),
    ).toBe('export * from "lit/decorators.js";\n')
    expect(load('\0virtual:importmap-export:missing', {} as any)).toBeNull()
    expect(emitFile).toHaveBeenCalledWith({
      type: 'chunk',
      id: 'virtual:importmap-export:lit/index.js',
      name: 'lit/index.js',
    })
  })

  it('falls back to the package main entry when exports are missing', () => {
    const plugin = pluginExposeDependency('@nanostores/lit')
    const emitFile = vi.fn()
    const buildStart = getHook(plugin.buildStart!)

    buildStart.call({ emitFile } as any, {} as any)

    expect(emitFile).toHaveBeenCalledWith({
      type: 'chunk',
      id: '@nanostores/lit/lib/index.js',
      name: '@nanostores/lit/index.js',
    })
  })

  it('handles custom export ordering, wildcard exports, skipped exports, and missing wildcard folders', () => {
    const plugin = pluginExposeDependency('./test-fixtures/expose-fixture')
    const emitFile = vi.fn()
    const buildStart = getHook(plugin.buildStart!)
    const load = getHook(plugin.load!)

    buildStart.call({ emitFile } as any, {} as any)

    expect(
      load(
        '\0virtual:importmap-export:./test-fixtures/expose-fixture/index.js',
        {} as any,
      ),
    ).toBe('export * from "./test-fixtures/expose-fixture";\n')
    expect(
      load(
        '\0virtual:importmap-export:./test-fixtures/expose-fixture/feature.js',
        {} as any,
      ),
    ).toBe('export * from "./test-fixtures/expose-fixture/feature.js";\n')
    expect(
      load(
        '\0virtual:importmap-export:./test-fixtures/expose-fixture/fallback.js',
        {} as any,
      ),
    ).toBe('export * from "./test-fixtures/expose-fixture/fallback.js";\n')
    expect(
      load(
        '\0virtual:importmap-export:./test-fixtures/expose-fixture/nested/alpha.js',
        {} as any,
      ),
    ).toBe('export * from "./test-fixtures/expose-fixture/nested/alpha.js";\n')
    expect(
      load(
        '\0virtual:importmap-export:./test-fixtures/expose-fixture/nested/deep/beta.mjs',
        {} as any,
      ),
    ).toBe(
      'export * from "./test-fixtures/expose-fixture/nested/deep/beta.mjs";\n',
    )

    expect(emitFile).toHaveBeenCalledWith({
      type: 'chunk',
      id: 'virtual:importmap-export:./test-fixtures/expose-fixture/index.js',
      name: './test-fixtures/expose-fixture/index.js',
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'chunk',
      id: 'virtual:importmap-export:./test-fixtures/expose-fixture/plain/*',
      name: './test-fixtures/expose-fixture/plain/*',
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'chunk',
      id: 'virtual:importmap-export:./test-fixtures/expose-fixture/nested/alpha.js',
      name: './test-fixtures/expose-fixture/nested/alpha.js',
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'chunk',
      id: 'virtual:importmap-export:./test-fixtures/expose-fixture/nested/deep/beta.mjs',
      name: './test-fixtures/expose-fixture/nested/deep/beta.mjs',
    })

    expect(
      emitFile.mock.calls.some(
        ([entry]) => entry.name === './test-fixtures/expose-fixture/skipped.js',
      ),
    ).toBe(false)
    expect(
      emitFile.mock.calls.some(
        ([entry]) =>
          entry.name === './test-fixtures/expose-fixture/empty-object.js',
      ),
    ).toBe(false)
    expect(
      emitFile.mock.calls.some(
        ([entry]) =>
          entry.name === './test-fixtures/expose-fixture/package.json',
      ),
    ).toBe(false)
    expect(
      emitFile.mock.calls.some(([entry]) =>
        String(entry.name).includes('/missing/'),
      ),
    ).toBe(false)
  })

  it('throws when the package json cannot be resolved', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('missing package.json')
    })

    expect(() => pluginExposeDependency('lit')).toThrow()
  })
})
