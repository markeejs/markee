import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(
  createMarkeeVitestConfig({
    test: {
      coverage: {
        include: [
          'index.ts',
          'extensions.ts',
          'helpers/**/*.ts',
          'pipelines/**/*.ts',
          'plugins/remark/accessible-headings.ts',
          'plugins/remark/abbreviations.ts',
          'plugins/remark/directive-remove-leaf.ts',
          'plugins/remark/attrs.ts',
          'plugins/remark/fontawesome.ts',
          'plugins/remark/footnote-ordering.ts',
          'plugins/remark/html-escape-sequences.ts',
          'plugins/remark/ins-and-mark.ts',
          'plugins/remark/lightbox.ts',
          'plugins/remark/material-icons.ts',
          'plugins/remark/nested-html.ts',
          'plugins/remark/prism.extensions.ts',
          'plugins/remark/prism.plugins.ts',
          'plugins/remark/prism.ts',
          'plugins/remark/simple-icons.ts',
          'plugins/remark/twemoji.ts',
          'plugins/rehype/footnote-ordering.ts',
          'plugins/rehype/prism.ts',
          'plugins/rehype/table-merge.ts',
          'plugins/rehype/tasklist.ts',
        ],
      },
    },
  }),
)
