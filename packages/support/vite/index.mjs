const markeeExternalPackages = [
  '@markee/state',
  '@markee/runtime',
  'nanostores',
  '@nanostores/persistent',
  '@nanostores/lit',
  'lit',
]

function isMarkeeRuntimeExternal(id) {
  if (typeof id !== 'string' || id.length === 0) {
    return false
  }

  return markeeExternalPackages.some(
    (pkg) => id === pkg || id.startsWith(`${pkg}/`),
  )
}

function matchesExternalEntry(entry, id, parentId, isResolved) {
  if (typeof entry === 'string') return entry === id
  if (entry instanceof RegExp) return entry.test(id)
  if (typeof entry === 'function') {
    return Boolean(entry(id, parentId, isResolved))
  }

  return false
}

function matchesExternal(external, id, parentId, isResolved) {
  if (!external) return false

  if (Array.isArray(external)) {
    return external.some((entry) =>
      matchesExternalEntry(entry, id, parentId, isResolved),
    )
  }

  return matchesExternalEntry(external, id, parentId, isResolved)
}

function createMarkeeExternalMatcher(external) {
  return (id, parentId, isResolved) => {
    return (
      isMarkeeRuntimeExternal(id) ||
      matchesExternal(external, id, parentId, isResolved)
    )
  }
}

function applyChunkFileNames(output) {
  const chunkFileNames = 'assets/_[name]-[hash].js'
  if (Array.isArray(output)) {
    return output.map((entry) => ({
      ...entry,
      chunkFileNames: entry.chunkFileNames ?? chunkFileNames,
    }))
  }

  return {
    ...output,
    chunkFileNames: output?.chunkFileNames ?? chunkFileNames,
  }
}

export function markee() {
  return {
    name: 'markee',
    enforce: 'pre',
    config(userConfig) {
      const build = userConfig?.build ?? {}
      const rollupOptions = build.rollupOptions ?? {}
      const output = applyChunkFileNames(rollupOptions.output)
      const resolvedExternal = createMarkeeExternalMatcher(
        rollupOptions.external,
      )

      return {
        base: './',
        build: {
          outDir: '_assets/_head',
          emptyOutDir: true,
          rollupOptions: {
            ...rollupOptions,
            input: ['src/main.ts'],
            output,
            external: resolvedExternal,
          },
        },
      }
    },
  }
}
