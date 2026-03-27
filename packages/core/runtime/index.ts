import type { SearchResult, TreeItem } from '@markee/state'

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
export {
  state,
  type TreeItem,
  type TreeLeaf,
  type SearchResult,
  type SearchData,
} from '@markee/state'
export * from './custom-elements.js'
