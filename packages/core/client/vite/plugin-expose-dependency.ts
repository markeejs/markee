import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

type ExportTarget =
  | string
  | { [cond: string]: ExportTarget }
  | Array<ExportTarget>

function pickExportTarget(target: ExportTarget): string | null {
  if (typeof target === 'string') return target
  if (Array.isArray(target)) {
    for (const t of target) {
      const picked = pickExportTarget(t)
      if (picked) return picked
    }
    return null
  }
  if (target && typeof target === 'object') {
    const order = [
      'browser',
      'import',
      'default',
      'module',
      'development',
      'production',
      'require',
    ]
    for (const k of order) {
      if (k in target) {
        const picked = pickExportTarget((target as any)[k])
        if (picked) return picked
      }
    }
    for (const k of Object.keys(target)) {
      const picked = pickExportTarget((target as any)[k])
      if (picked) return picked
    }
  }
  return null
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = []
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()!
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) stack.push(p)
      else out.push(p)
    }
  }
  return out
}

function resolvePackageRoot(pkg: string): string {
  return path.dirname(require.resolve(pkg))
}

function resolvePackageJson(dir: string) {
  while (true) {
    try {
      const pkgJsonPath = path.resolve(dir, 'package.json')
      return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as any
    } catch (err) {
      void err
      const parent = path.dirname(dir)
      if (parent === dir) {
        throw new Error(`Could not resolve package.json from ${dir}`)
      }
      dir = parent
    }
  }
}

function exposePkgExportsForImportMap(pkgName: string): Plugin {
  const pkgDir = resolvePackageRoot(pkgName)
  const pkgJson = resolvePackageJson(pkgDir)
  const exportsField = pkgJson.exports ?? {}

  const VIRTUAL_PREFIX = 'virtual:importmap-export:'
  const RESOLVED_PREFIX = '\0' + VIRTUAL_PREFIX

  const resolvedVirtualToSpecifier = new Map<string, string>()
  const virtualIdsToEmit: { id: string; name: string }[] = []

  function keyToSpecifier(key: string): string {
    if (key === '.' || key === './') return pkgName
    if (key.startsWith('./')) return `${pkgName}/${key.slice(2)}`
    return `${pkgName}/${key}`
  }

  function keyToEntryName(key: string): string {
    if (key === '.' || key === './') return `${pkgName}/index.js`
    if (key.startsWith('./')) return `${pkgName}/${key.slice(2)}`
    return `${pkgName}/${key}`
  }

  function addEntry(entryName: string, specifier: string) {
    const virtualId = `${VIRTUAL_PREFIX}${entryName}`
    const resolvedId = `${RESOLVED_PREFIX}${entryName}`
    resolvedVirtualToSpecifier.set(resolvedId, specifier)
    virtualIdsToEmit.push({ id: virtualId, name: entryName })
  }

  function expandWildcardExport(key: string, chosenTarget: string) {
    if (!key.endsWith('/*')) return false
    if (!chosenTarget.includes('*')) return false

    const keyPrefix = key.slice(0, -1)
    const targetPrefix = chosenTarget.slice(0, chosenTarget.indexOf('*'))

    const absTargetDir = path.resolve(pkgDir, targetPrefix)
    if (
      !fs.existsSync(absTargetDir) ||
      !fs.statSync(absTargetDir).isDirectory()
    )
      return true

    const files = listFilesRecursive(absTargetDir)
      .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))
      .sort()

    for (const f of files) {
      const rel = path.relative(absTargetDir, f).replaceAll(path.sep, '/')
      const exportKey = `${keyPrefix}${rel}`
      addEntry(keyToEntryName(exportKey), keyToSpecifier(exportKey))
    }
    return true
  }

  for (const [key, target] of Object.entries(exportsField)) {
    if (key === './package.json') continue
    const chosen = pickExportTarget(target as ExportTarget)
    if (!chosen) continue
    if (expandWildcardExport(key, chosen)) continue
    addEntry(keyToEntryName(key), keyToSpecifier(key))
  }

  if (!virtualIdsToEmit.length) {
    virtualIdsToEmit.push({
      id: keyToEntryName(pkgJson.main),
      name: keyToSpecifier('index.js'),
    })
  }

  return {
    name: 'expose-pkg-exports-for-importmap',
    apply: 'build',

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        const name = id.slice(VIRTUAL_PREFIX.length)
        return RESOLVED_PREFIX + name
      }
      return null
    },

    load(id) {
      const spec = resolvedVirtualToSpecifier.get(id)
      if (!spec) return null
      return `export * from ${JSON.stringify(spec)};\n`
    },

    buildStart() {
      for (const e of virtualIdsToEmit) {
        this.emitFile({ type: 'chunk', id: e.id, name: e.name })
      }
    },
  }
}

export function pluginExposeDependency(dep: string) {
  return exposePkgExportsForImportMap(dep)
}

pluginExposeDependency.chunk = function (dep: string, name: string) {
  if (name.startsWith(dep + '/')) return `assets/${name}`
  return null
}
