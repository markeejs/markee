import { atom, computed } from 'nanostores'
import type { MarkeeSearchIndexer, SearchOptions } from '@markee/search'
import type { searchPipeline } from '@markee/pipeline'
import { $searchLoader, $navigationLoader } from './metadata.js'

export interface SearchResult {
  file: string
  results: {
    label: string
    anchor: string
    content: string
  }[]
}

export interface SearchData {
  id: string
  key: string
  tags: string[]
  content: string
  title: string
  label: string
  info: {
    anchor: string
    content: string
    label: string
  }
}

const $searchPipeline = atom<typeof searchPipeline | null>(null)
const $searchIndexer = atom<typeof MarkeeSearchIndexer | null>(null)

let firstSearch = true

export const $search = computed(
  [$searchLoader, $navigationLoader, $searchPipeline, $searchIndexer],
  (searchLoader, navigationLoader, searchPipeline, MarkeeSearchIndexer) => {
    if (firstSearch) {
      return ((keyword: any) => {
        if (!keyword) return []

        firstSearch = false

        import('@markee/pipeline/pipelines/search.js').then(
          ({ searchPipeline }) => {
            $searchPipeline.set(searchPipeline)
          },
        )
        import('@markee/search').then(({ MarkeeSearchIndexer }) => {
          $searchIndexer.set(MarkeeSearchIndexer)
        })

        return []
      }) as unknown as typeof fn
    }

    if (
      !searchLoader.data ||
      !navigationLoader.data ||
      !searchPipeline ||
      !MarkeeSearchIndexer
    )
      return (() => []) as unknown as typeof fn

    const search = searchLoader.data
    const { files } = navigationLoader.data

    const dataset = Object.entries(search).flatMap(([key, data]) => {
      const file = files[key]
      if (!file) return []

      const tags = (file.frontMatter?.tags ?? []).map((t) => t.toLowerCase())
      const title = file.frontMatter?.title ?? ''

      return Object.keys(data).flatMap((anchor, j) => {
        if (!data[anchor].c) {
          return []
        }
        return data[anchor].c.map(
          (content, i): SearchData => ({
            id: `${key}#${anchor}?${i}`,
            key,
            tags,
            content: content.toLowerCase(),
            title: j || i ? '' : title.toLowerCase(),
            label: i ? '' : data[anchor].l.toLowerCase(),
            info: {
              content,
              anchor,
              label: data[anchor].l,
            },
          }),
        )
      })
    })

    const index = new MarkeeSearchIndexer(dataset, {
      textFields: {
        tags: { weight: 1.5 },
        title: { weight: 1.2, exactMatchBoost: 1.2 },
        label: { weight: 1, exactMatchBoost: 1.2 },
        content: { weight: 1, exactMatchBoost: 1.5, proximityBoost: true },
      },
      prefilterIndexes: {
        tags: { normalize: 'fold' },
        key: { normalize: 'fold' },
      },
    })

    const fn = (
      search: string,
      options?: SearchOptions<(typeof dataset)[number]>,
    ) => {
      const results = index.search(search.toLowerCase(), options)
      const groupedByFile: Map<string, SearchResult> = new Map()

      results.forEach((result) => {
        const group = groupedByFile.get(result.doc.key) ?? {
          file: result.doc.key,
          results: [],
        }
        groupedByFile.set(result.doc.key, group)
        group.results.push({
          label: result.doc.info.label,
          anchor: result.doc.info.anchor,
          content: searchPipeline(result.doc.info.content),
        })
      })

      return [...groupedByFile.values()]
    }

    fn.anyOf = index.anyOf
    fn.allOf = index.allOf

    return fn
  },
)
