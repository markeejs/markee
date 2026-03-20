import { computed, map, onMount } from 'nanostores'
import { cache } from '../cache.js'

// @ts-ignore - meta.env is not defined at the project level
const isTestEnv = !!import.meta.env.VITEST

async function loadMetadataFile(path: string) {
  const content = await cache(`/_markee/${path}.json`, 'json')

  if (path === 'navigation') {
    const navigation = content as ReturnType<(typeof $navigation)['get']> & {
      splits?: string[]
    }
    if (navigation.splits) {
      const splits = await Promise.all(
        navigation.splits.map((split) =>
          cache<typeof navigation>(
            `${split}/_markee/${path}.json`,
            'json',
          ).catch(() => ({ files: {}, folders: {} })),
        ),
      )

      splits.forEach((split) => {
        navigation.files = { ...navigation.files, ...split?.files }
        navigation.folders = { ...navigation.folders, ...split?.folders }
      })

      Object.values(navigation.folders).forEach((folder) => {
        folder.navigation = folder.navigation?.filter(
          (entry) =>
            !entry.split ||
            navigation.files[entry.key] ||
            navigation.folders[entry.key],
        )
        folder.excluded = folder.excluded?.filter(
          (entry) =>
            !entry.split ||
            navigation.files[entry.key] ||
            navigation.folders[entry.key],
        )
        folder.versions = folder.versions?.filter(
          (entry) =>
            !entry.split ||
            navigation.files[entry.key] ||
            navigation.folders[entry.key],
        )
      })
    }
  }

  if (path === 'search') {
    const search = content as Record<string, any>
    if (search._splits) {
      const splits = await Promise.all(
        search._splits.map((split: string) =>
          cache(`${split}/_markee/${path}.json`, 'json').catch(() => ({})),
        ),
      )
      delete search._splits

      return splits.reduce((acc, curr) => ({ ...acc, ...curr }), search)
    }
  }

  return content
}

function createMetadataStore<T>(path: string) {
  const $_map = map({ loading: true, data: null as null | T, error: null })
  const $map = $_map as typeof $_map & {
    refresh: () => Promise<void>
    promise?: Promise<void>
  }

  const refresh = () => {
    if ($map.promise) {
      return $map.promise
    }

    $map.setKey('loading', true)
    $map.promise = loadMetadataFile(path)
      .then((data) => $map.set({ loading: false, data, error: null }))
      .catch((error) => {
        console.error(error)
        $map.setKey('error', error)
        $map.setKey('loading', false)
      })
      .finally(() => {
        delete $map.promise
      })
    return $map.promise
  }

  installMetadataAutoRefresh($map, refresh, isTestEnv)
  $map.refresh = refresh

  return $map
}

export const $navigationLoader = createMetadataStore<{
  folders: Record<string, SectionFile>
  files: Record<string, MarkdownFile>
  assets: Record<string, string>
}>('navigation')
export const $layoutsLoader = createMetadataStore<{
  header?: string
  footer?: string
  layouts: Record<
    string,
    {
      main?: string
      left?: string
      right?: string
      top?: string
      bottom?: string
    }
  >
}>('layouts')
export const $configLoader = createMetadataStore<Configuration>('config')
export const $searchLoader = createMetadataStore<SearchIndex>('search')

export async function revalidateMetadata() {
  void $configLoader.refresh()
  void $searchLoader.refresh()
  await $navigationLoader.refresh()
  void $layoutsLoader.refresh()
}

export function scheduleMetadataRevalidation(skip?: boolean) {
  if (skip) return
  requestAnimationFrame(revalidateMetadata)
}

export function installMetadataAutoRefresh(
  store: Parameters<typeof onMount>[0],
  refresh: () => void,
  skip?: boolean,
) {
  if (skip) return
  return onMount(store, () => {
    requestAnimationFrame(refresh)
  })
}

scheduleMetadataRevalidation(isTestEnv)

export const $navigation = computed(
  $navigationLoader,
  (loader) => loader.data ?? { files: {}, folders: {}, assets: {} },
)
export const $metadataReady = computed(
  [$configLoader, $layoutsLoader, $navigationLoader],
  (config, layouts, nav) => {
    return !!(config.data && nav.data && layouts.data)
  },
)
