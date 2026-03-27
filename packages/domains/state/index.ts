import { computed, type ReadableAtom, type StoreValue } from 'nanostores'
import { persistentAtom } from '@nanostores/persistent'

import {
  $navigation,
  $configLoader,
  $searchLoader,
  $layoutsLoader,
  $navigationLoader,
} from './store/metadata.js'
import { $currentFile, $currentLoader } from './store/current.js'
import { $navigationTree } from './store/tree.js'
import { $router } from './store/router.js'
import { $search } from './store/search.js'

const $colorScheme = persistentAtom<'auto' | 'light' | 'dark'>(
  'color-scheme',
  'auto',
)

type StoreValues<Stores extends (keyof typeof stores)[]> = {
  [Index in keyof Stores]: StoreValue<(typeof stores)[Stores[Index]]>
}

const stores = {
  $router: computed([$router], (router) => ({
    ...router,
    navigate: {
      open: (page: string) => $router.open(page),
      replace: (page: string) => $router.open(page, true),
    },
  })),

  $config: computed($configLoader, (loader) => loader.data),
  $navigation: computed([$navigation, $navigationTree], (navigation, tree) => ({
    ...navigation,
    tree,
  })),
  $currentFile,
  $currentLoader: computed($currentLoader, (loader) =>
    loader
      ? { loading: false, data: loader, error: null }
      : { loading: true, data: null, error: null },
  ),
  $payload: computed(
    [$currentFile, $layoutsLoader, $navigationLoader],
    (file, layouts, navigation) => ({
      for(opts: { plugin: string; element: HTMLElement }) {
        const isContent = !!opts.element.closest('markee-content')
        const sectionParent = opts.element.closest('[id^="markee-"]')
        if (!isContent && sectionParent) {
          const layout = file?.layout ?? '404'
          const key =
            {
              'markee-header': layouts.data?.header,
              'markee-footer': layouts.data?.footer,
              'markee-section-top': layouts.data?.layouts?.[layout]?.top,
              'markee-section-bottom': layouts.data?.layouts?.[layout]?.bottom,
              'markee-section-left': layouts.data?.layouts?.[layout]?.left,
              'markee-section-right': layouts.data?.layouts?.[layout]?.right,
              'markee-section-main': layouts.data?.layouts?.[layout]?.main,
            }[sectionParent.id] ?? ''
          const payloadFile = navigation.data?.files[key] ?? null
          return payloadFile?.payload[key]?.[opts.plugin] ?? null
        }

        return file?.payload[opts.element.id]?.[opts.plugin] ?? null
      },
    }),
  ),
  $pluginConfig: computed(
    [$currentFile, $configLoader],
    (file, configLoader) => ({
      for<T>(plugin: string) {
        return ((file?.frontMatter?.plugins as any)?.[plugin] ??
          (configLoader?.data?.plugins as any)?.[plugin]) as T
      },
    }),
  ),

  $searchIndex: computed([$searchLoader], (loader) => loader),
  $search,

  $colorScheme,
}

export const state = {
  ...stores,
  combine<T extends (keyof typeof stores)[]>(
    $stores: [...T],
  ): ReadableAtom<StoreValues<T>> {
    return computed(
      $stores.map((store) => state[store]),
      (...values) => values as StoreValues<T>,
    )
  },
  compute<T extends (keyof typeof stores)[], R>(
    $stores: [...T],
    transform: (...values: StoreValues<T>) => R,
  ) {
    return computed(
      $stores.map((store) => state[store]),
      (...values) => transform(...(values as StoreValues<T>)),
    )
  },
}

export type { SearchData, SearchResult } from './store/search.js'
export type { TreeItem, TreeLeaf } from './store/tree.js'
