import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        include: [
          '**/_assets/_head/remark-kroki.mjs',
          '**/_assets/shared/kroki-resolver.mjs',
        ],
      },
    },
  }),
)
