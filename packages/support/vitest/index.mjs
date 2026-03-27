const baseAliases = [
  { find: /^@markee\/runtime$/, replacement: '@markee/runtime/index.ts' },
  { find: /^@markee\/state$/, replacement: '@markee/state/index.ts' },
  { find: /^@markee\/pipeline$/, replacement: '@markee/pipeline/index.ts' },
  { find: /^@markee\/search$/, replacement: '@markee/search/index.ts' },
  { find: /^@markee\/elements$/, replacement: '@markee/elements/index.ts' },
  { find: /^@markee\/types$/, replacement: '@markee/types/index.d.ts' },
  {
    find: /^@markee\/runtime\/index\.js$/,
    replacement: '@markee/runtime/index.ts',
  },
  {
    find: /^@markee\/state\/index\.js$/,
    replacement: '@markee/state/index.ts',
  },
  {
    find: /^@markee\/pipeline\/index\.js$/,
    replacement: '@markee/pipeline/index.ts',
  },
  {
    find: /^@markee\/search\/index\.js$/,
    replacement: '@markee/search/index.ts',
  },
  {
    find: /^@markee\/elements\/index\.js$/,
    replacement: '@markee/elements/index.ts',
  },
]

export function createMarkeeVitestConfig(options = {}) {
  const test = options.test ?? {}
  const coverage = test.coverage ?? {}

  return {
    resolve: {
      alias: [...baseAliases, ...(options.aliases ?? [])],
    },
    test: {
      environment: 'jsdom',
      setupFiles: './vitest.setup.ts',
      ...test,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './dist/coverage',
        thresholds: {
          100: true,
        },
        ...coverage,
        exclude: [
          ...(coverage?.exclude ?? []),
          '**/*.test.ts',
          'vite.config.ts',
          'vitest.config.ts',
          'vitest.setup.ts',
          'dist/**',
          '_assets/_head/assets/**',
        ],
      },
    },
  }
}
