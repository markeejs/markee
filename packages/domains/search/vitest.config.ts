import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['index.ts', 'internal.ts'],
      },
    },
  }),
)
