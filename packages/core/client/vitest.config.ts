import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        exclude: ['vite/test-fixtures/**'],
      },
    },
  }),
)
