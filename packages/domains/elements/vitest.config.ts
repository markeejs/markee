import { defineConfig } from 'vitest/config'

export default defineConfig({
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
      },
    },
  },
})
