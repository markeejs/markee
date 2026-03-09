# Shared State

Internally, Markee uses [nanostores](https://github.com/nanostores/nanostores) to maintain the current state (metadata download, routing, current file information...).

Part of that state is useful when building extensions, so it is exposed through the `@markee/runtime` module.
`@markee/runtime` re-exports `state` from `@markee/state`, so extension scripts only need one Markee entrypoint.

## Usage

`@markee/runtime` is installed automatically with `@markee/cli`, so you get typings and autocomplete in your IDE.

On the client, it is bundled into the main client exposed by Markee, but is made available
as a module through an import map entry.

You can import it as follows:

```js
import { state } from '@markee/runtime'

// Read the current configuration
console.log(state.$config.get())
```

## Available variables

Here is a list of all the variables available in the `state` object.

### `$router`

:::snippet[Complete type]{collapsed}
```ts
type Router = {
  path?: string
  search?: Record<string, string>
  navigate: {
    open: (path: string) => void
    replace: (path: string) => void
  }
}
```
:::

The `$router` state contains the current routing information (path, search query parameters) as well
as helpers for soft-navigation.

The `$router.get().navigate.open` helper triggers a soft navigation to the passed URL.
The `$router.get().navigate.replace` helper replaces the current browser history entry with the passed URL, without
adding a new entry.

### `$config`

The `$config` state contains the loaded configuration as defined at build time
through the CLI. You can read the configuration through `$config.get()`, or subscribe
to it through `$config.subscribe()`.

When building custom elements, you will be able to read the configuration directly from `$config.get()`,
as it will already be loaded before your element is connected, and it never changes.

However sometimes you might need to read it as a side effect of a custom script, running
as soon as the script is loaded. In this case it will most likely not be loaded yet so
`state.$config.get()` will be `null`. You'll need to subscribe to `state.$config`
and check for it to be present:

```js
import { state } from '@markee/runtime'

state.$config.subscribe((config) => {
  if (config) {
    // You can safely consume config here
  }
})
```

:::info[Development mode]
If you want your element to react to config changes live during development mode, then you will want
to subscribe to the state rather than reading synchronously.
:::

See [Config file](../../configuration/config-file.md) to know all the information
you can get from the `$config` state.

### `$colorScheme`

Contains the currently selected color scheme (`auto`, `light` or `dark`). Can also be used to select which scheme
to apply.

```js
// Force theme to dark
state.$colorScheme.set('dark')
```

### `$currentFile`

:::snippet[Complete type]{collapsed}
```ts
type CurrentFile = {
  key: string
  link: string
  frontMatter: Frontmatter
  layout: string
  readingTime: number
  revisionDate?: number
} | undefined
```
:::

The `$currentFile` state contains information about the file pointed at
by the current URL.

It is useful to get information about the file such as its front-matter,
its layout...

The `$currentFile` content is updated as soon
as the URL changes, even before the actual content of the file is ready.

So, if you want to react to the current file only once it is loaded,
you might prefer subscribing to `$currentLoader`. You can always read synchronously
inside `$currentFile` in a `$currentLoader` subscription.

```js
import { state } from '@markee/runtime'

state.$currentFile.subscribe((file) => {
  // Will run as soon as the URL changes
})

state.compute(['$currentLoader'], (loader) => !loader.loading)
  .subscribe((done) => {
    if (done) {
      const file = state.$currentFile.get()
      // Will run once the file content is ready
    }
  })
```

### `$currentLoader`

:::snippet[Complete type]{collapsed}
```ts
type CurrentLoader = {
  loading: boolean
  error?: Error
  data?: {
    key: string
    layout: string
    content: string
  }
}
```
:::

The `$currentLoader` state contains information about the loading state of the current document. At its root you will
find a `loading` flag indicating whether the file content is currently being loaded. This flag is also synced on the `body`
element as a `data-loading` attribute to offer a styling hook for the loading state.

Optionally, you can read the `error` field once the `loading` flag is `false`. If `error` is set, then it means something
went wrong when reading the file content.

If all went well however, `data` will be set with three sub-fields:

- **`key: string`**: unique file key, usable to read its data from `state.$navigation.get().files`. 
- **`layout: string`**: layout selected for that file.
- **`content: string`**: HTML content of the file, transformed from Markdown.

In most cases, if you are writing an extension which requires to react to the current file change, you will want to
subscribe to `$currentLoader` and wait for its loading state to settle.

### `$navigation`

:::snippet[Complete type]{collapsed}
```ts
type File = {
  link: string
  layout: string
  frontMatter: Frontmatter
  revisionDate?: number
  readingTime: number
  root?: string
}

type Folder = {
  title?: string
  collapsible?: boolean
  hidden?: boolean
  draft?: boolean
  navigation: {
    key: string
    title?: string
  }[]
  version?: {
    folder?: boolean
    name?: string
    date?: string
    latestPathAlias?: string
  }
  versions?: {
    key: string
  }[]
}

interface TreeLeaf {
  key: string
  label: string
  link: string
  hidden: boolean
  parent?: TreeItem
}

interface TreeItem {
  key: string
  indexKey?: string
  label: string
  hidden: boolean
  items?: (TreeItem | TreeLeaf)[]
  link?: string
  parent?: TreeItem
}

type Navigation = {
  files: Record<string, File>,
  folders: Record<string, Folder>
  tree: Partial<TreeItem> & {
    reload(): void
    getBranchByKey(key: string): TreeItem | TreeLeaf | null
    getAncestorsForKey(key: string): (TreeItem | TreeLeaf)[]
  }
}
```
:::

The `$navigation` state variable contains the metadata for the sitemap: `$navigation.get().folders` contains information
about each folder of your website, while `$navigation.get().files` contains information about Markdown source files.

For instance, you can get all information about the current file by doing:

```js
import { state } from '@markee/runtime'

const files = state.$navigation.get().files
const fileKey = state.$currentLoader.get().data?.key
const file = files[fileKey]
```

`$navigation.get().tree` contains the navigation information built as a file tree. The tree is formed as a linked chain,
meaning that each item has a `parent` property pointing to whichever item contains it.

The root element of the tree also contains three helper methods:
 
- `tree.reload()`: forces a recomputation of the complete tree. Mostly used internally for recomputing the tree
                   on version selection for [versioned content](../../configuration/versioning/before.md){version=latest}.
- `tree.getBranchByKey(key: string)`: finds the item (folder or file) corresponding to the passed key. Uses an internal cached
                                      map for O(1) lookup.
- `tree.getAncestorsForKey(key: string)`: returns an array of ordered ancestors, from the root of the tree until the specified item.
                                          Uses the internal lookup cache and the linked chain for O(1) lookup.

### `$searchIndex`

:::snippet[Complete type]{collapsed}
```ts
type SearchIndexLoader = {
  loading: boolean
  error: Error | null
  data: SearchIndex | null
}
```
:::

`$searchIndex` exposes the raw search index loader state.
This is mostly useful when you need access to low-level index data or loading/error status.

### `$search`

:::snippet[Complete type]{collapsed}
```ts
interface SearchData {
  /** Unique ID of the search entry (one per paragraph per document) */
  id: string
  /** Unique ID of the document the entry belongs to */
  key: string
  /** Tags associated with the document */
  tags: string[]
  /** Raw content of the entry **/
  content: string
  /** Title of the document */
  title: string
  /** Label of the heading closest to the entry */
  label: string
  /** Additional metadata used internally for result rendering */
  info: {
    anchor: string
    content: string
    label: string
  }
}

type StringMatchMode = 'startsWith' | 'endsWith' | 'includes' | 'equals'
type NormalizeMode = 'fold' | 'trim' | 'none'

interface SearchOptions {
  /** Maximum number of results to return. Default: 100. */
  limit?: number
  /** Prefer docs matching more unique query terms. Default: true. */
  preferAllTerms?: boolean
  /** Max fuzzy candidates per query term. Default: 48. */
  fuzzyMaxCandidates?: number
  /** Predicate filters. Some may include prefilter metadata. */
  filters?: Array<IndexedFilter<SearchData> | ((doc: SearchData) => boolean)>
  /**
   * If true and query yields no tokens, run filters against all docs and return score=0 results.
   * Default: false.
   */
  allowEmptyQueryWithFilters?: boolean
}

interface Search {
  (term: string, options?: SearchOptions): {
    file: string
    results: {
      label: string
      anchor: string
      content: string
    }[]
  }[]
  
  anyOf(
    key: keyof SearchData,
    needles: string[],
    mode?: StringMatchMode,
    normalize?: NormalizeMode
  ): IndexedFilter<SearchData>
  allOf(
    key: keyof SearchData,
    needles: string[],
    mode?: StringMatchMode,
    normalize?: NormalizeMode
  ): IndexedFilter<SearchData>
}
```
:::

The `$search` state variable contains a function which you can call to get a list of documents matching a query.

The search functionality uses a custom search index tailored for speed and accuracy on Markee documents.

The search method returns a list of results, grouped by files, and already sorted by relevance.

In most cases, you will not use this directly, and instead will rely on the
[`markee-search` custom element](../../configuration/layouts/preconfigured-elements.md#markee-search) 
which uses it internally.

The variable contained in `$search` also contains two static methods aimed at building filters to be passed
as options. Both methods take a key and an array of needles, and build a custom filter object to refine queries.
You can optionally pass a `mode` (`startsWith`, `endsWith`, `includes`, `equals`) and a normalization strategy.

- `search.anyOf(key, needles, mode?, normalize?)`: matches when at least one needle matches.
- `search.allOf(key, needles, mode?, normalize?)`: matches when all needles match.

You can also provide your own custom filters, in the form of a function which takes a document and returns a `true` if it matches, `false` otherwise.

### `$payload`

:::snippet[Complete type]{collapsed}
```ts
type Payload = {
  for(opts: { plugin: string; element: HTMLElement }): any
}
```
:::

The `$payload` state variable exposes a `.for(...)` helper used to retrieve data preloaded by build-time plugins.

```js
const payload = state.$payload.get().for({
  plugin: 'kroki',
  element: this,
})
```

:::note
`$payload` takes an `HTMLElement` because it resolves whether the payload belongs to the
main document content or to a layout section.
:::

This is mostly useful when combining client-side custom elements with preloading done in
[build-time plugins](../build-time.md).

### `$pluginConfig`

:::snippet[Complete type]{collapsed}
```ts
type PluginConfig = {
  for<T = any>(pluginName: string): T | undefined
}
```
:::

`$pluginConfig` resolves plugin configuration for the current file.

Resolution order:

- file front-matter `plugins.<name>`
- global config `plugins.<name>`

```js
const kroki = state.$pluginConfig.get().for('kroki')
const serverUrl = kroki?.serverUrl
```

## Helpers

Alongside state variables, the `state` object provides two helpers to manage your state subscriptions.

### `combine`

`state.combine` lets you select multiple state variables by their name and subscribe to them all at once.
The subscription listener will be called every time one of the underlying variable changes.

```js
import { state } from '@markee/runtime'

state
  .combine(['$config', '$navigation'])
  .subscribe(([config, navigation]) => {
    console.log('Metadata were updated')
    console.log({ config, navigation })
  })
```

### `compute`

`state.compute` lets you select multiple state variables, apply a transformation to their values, and
subscribe to the result of the transformation.
The subscription listener will be called every time the result of the transformation changes.

```js
import { state } from '@markee/runtime'

state
  .compute(['$currentLoader'], (loader) => loader.data?.key)
  .subscribe((key) => {
    console.log('Currently loaded file key:', key)
  })
```
