import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    aliases: [
      {
        find: /^@markee\/pipeline\/pipelines\/client\.js$/,
        replacement: '@markee/pipeline/pipelines/client.ts',
      },
      {
        find: /^@markee\/pipeline\/pipelines\/search\.js$/,
        replacement: '@markee/pipeline/pipelines/search.ts',
      },
    ],
    test: {
      coverage: {
        provider: 'v8',
        include: ['index.ts', 'cache.ts', 'store/**/*.ts'],
      },
    },
  }),
)
