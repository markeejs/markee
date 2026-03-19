import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        include: ['index.ts', 'cache.ts', 'store/**/*.ts'],
        thresholds: { 100: true },
      },
    },
  }),
)
