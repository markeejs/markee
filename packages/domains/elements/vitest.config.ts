import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@markee\/runtime$/, replacement: '@markee/runtime/index.ts' },
      { find: /^@markee\/state$/, replacement: '@markee/state/index.ts' },
      { find: /^@markee\/pipeline$/, replacement: '@markee/pipeline/index.ts' },
      { find: /^@markee\/search$/, replacement: '@markee/search/index.ts' },
      { find: /^@markee\/elements$/, replacement: '@markee/elements/index.ts' },
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
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './dist/coverage',
      include: ['blocks/**/*.ts', 'elements/**/*.ts', 'utils/**/*.ts'],
      exclude: ['**/*.test.ts', 'vitest.config.ts', 'vitest.setup.ts'],
      thresholds: {
        'blocks/markee-collapse.ts': {
          100: true,
        },
        'blocks/markee-drawer.ts': {
          100: true,
        },
        'blocks/markee-popover.ts': {
          100: true,
        },
        'blocks/markee-select.ts': {
          100: true,
        },
        'blocks/markee-scroll-area.ts': {
          100: true,
        },
        'elements/markee-article.ts': {
          100: true,
        },
        'elements/markee-article-list.ts': {
          100: true,
        },
        'utils/compare-link.ts': {
          100: true,
        },
        'utils/extensions.ts': {
          100: true,
        },
        'utils/highlight.ts': {
          100: true,
        },
        'utils/navigation.ts': {
          100: true,
        },
        'utils/pagination.ts': {
          100: true,
        },
        'utils/prism.ts': {
          100: true,
        },
        'utils/scrollarea.ts': {
          100: true,
        },
        'utils/siblings.ts': {
          100: true,
        },
        'utils/table-of-contents.ts': {
          100: true,
        },
      },
    },
  },
})
