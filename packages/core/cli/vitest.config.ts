import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      environment: 'node',
      coverage: {
        exclude: ['src/global.d.ts'],
      },
    },
  }),
)
