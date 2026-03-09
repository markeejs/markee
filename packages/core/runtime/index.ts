import type {} from '@markee/types'

import { markdownPipeline } from '@markee/pipeline/extensions.js'
import { prism } from '@markee/pipeline/plugins/remark/prism.extensions.js'

export const extend = {
  search: {} as {
    groupResults?: (results: SearchResult[]) =>
      | void
      | SearchResult[]
      | {
          sectionName: string
          results: SearchResult[]
        }[]
    getShardingKeys?: () => string[]
  },
  navigation: {} as {
    filterTree?: (tree: TreeItem, root: TreeItem | null) => TreeItem
  },
  markdownPipeline,
  prism,
}

export const development = !!(window as any)[Symbol.for('markee::development')]
export { state } from '@markee/state'
export * from './custom-elements.js'

declare module 'unified' {
  interface Data {
    config?: Configuration | null
    frontMatter?: MarkdownFile['frontMatter']
    pluginConfig: <T = any>(pluginName: string) => T | undefined
  }
}
