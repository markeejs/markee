import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        include: ['index.ts', 'index.js', 'custom-elements.ts'],
      },
    },
  }),
)
