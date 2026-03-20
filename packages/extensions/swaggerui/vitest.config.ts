import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        include: ['src/helpers.ts', 'src/filters.ts', 'src/remark.ts'],
      },
    },
  }),
)
