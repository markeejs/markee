# Runtime Hooks

`@markee/runtime` exposes an `extend` object for runtime customization hooks.
Unlike `extend.markdownPipeline` (which changes Markdown parsing), these hooks customize UI behaviors built on top of Markee state.

```js
import { extend } from '@markee/runtime'
```

## When to register hooks

Register hooks at module load time in scripts injected from `_assets/_head`.

Do this once, at the top level of your module:

```js
import { extend } from '@markee/runtime'

extend.search.getShardingKeys = () => ['^/docs/', '^/blog/']
```

Avoid assigning hooks inside element lifecycle callbacks (`connectedCallback`, `render`, etc.), because those can run multiple times.

## Search Hooks (`extend.search`)

Use `extend.search` when you want to customize how `markee-search` resolves and displays results.

### `extend.search.getShardingKeys`

```ts
getShardingKeys?: () => string[]
```

Returns key shards used to prefilter search documents.

Each shard is matched against the search document `key`:

- no marker: `includes`
- `^prefix`: `startsWith`
- `suffix$`: `endsWith`
- `^exact$`: exact match

Use this when:

- your content is split into large areas (`/docs`, `/blog`, `/guides`)
- you want to scope search to selected areas
- you want predictable search latency on large indexes

Example:

```js
import { extend } from '@markee/runtime'

extend.search.getShardingKeys = () => ['^/docs/', '^/blog/']
```

### `extend.search.groupResults`

```ts
groupResults?: (
  results: SearchResult[],
) =>
  | void
  | SearchResult[]
  | {
      sectionName: string
      results: SearchResult[]
    }[]
```

Transforms raw search results before rendering.

Use this when:

- you want section headers in the result UI
- you want to reorder or merge result sets
- you want stable grouping semantics by source, folder, or custom taxonomy

Example (group by first path segment):

```js
import { extend } from '@markee/runtime'

extend.search.groupResults = (results) => {
  const groups = new Map()

  for (const result of results) {
    const first = result.file.split('/').filter(Boolean)[0] ?? 'other'
    const name = first[0].toUpperCase() + first.slice(1)
    const bucket = groups.get(name) ?? []
    bucket.push(result)
    groups.set(name, bucket)
  }

  return [...groups.entries()].map(([sectionName, grouped]) => ({
    sectionName,
    results: grouped,
  }))
}
```

## Navigation Hooks (`extend.navigation`)

Use this hook when you need to control the tree rendered by navigation elements.

```ts
extend.navigation.filterTree?: (
  tree: TreeItem,
  root: TreeItem | null,
) => TreeItem
```

Parameters:

- `tree`: the tree that would be rendered with current root selection
- `root`: the full navigation root (as if `rootSegments` were `1`)

Use this when:

- you need custom pruning beyond `data-root-segments`
- you want to reorder sections
- you want to hide or reshape parts of the tree for specific layouts

Example (hide private sections):

```js
import { extend } from '@markee/runtime'

function prunePrivate(node) {
  if (!node) return node
  const hidden = node.key.includes('/_private/')
  if (hidden) return null

  const items = node.items
    ?.map((child) => prunePrivate(child))
    .filter(Boolean)

  return {
    ...node,
    items: items?.length ? items : undefined,
  }
}

extend.navigation.filterTree = (tree) => prunePrivate(tree) ?? tree
```

## Prism Hooks (`extend.prism`)

Use `extend.prism` when you need runtime control over code highlighting themes or language loading.

```ts
extend.prism.lightTheme: PrismTheme
extend.prism.darkTheme: PrismTheme
extend.prism.loadTheme(theme: PrismTheme): Promise<void>
extend.prism.getTheme(theme: PrismTheme): Promise<string>
extend.prism.loadLanguage(lang: string): Promise<void>
```

Use this when:

- you want different light/dark themes than the defaults
- you want to control Prism's theme outside the normal light/dark auto-selection
- you need to load additional Prism languages on demand

### Theme selection

`lightTheme` and `darkTheme` are reactive setters.
When you assign one of them, Markee reapplies Prism CSS immediately for the current color scheme.

Use this to configure the Prism theme you want to use for each color scheme.

```js
import { extend } from '@markee/runtime'

extend.prism.lightTheme = 'coy'
extend.prism.darkTheme = 'okaidia'
```

### Manual theme loading

Use `loadTheme` if you want to force a specific theme regardless of the current light/dark selection.

```js
import { extend } from '@markee/runtime'

await extend.prism.loadTheme('tomorrow')
```

Use `getTheme` if you need the raw CSS string (for custom injection or debugging).

```js
import { extend } from '@markee/runtime'

const css = await extend.prism.getTheme('oneDark')
console.log(css.length)
```

### Dynamic language loading

Markee will automatically load languages used in your code fences. But if you want to highlight
code rendered manually by a custom element, you will need to load the language manually.

Use `loadLanguage` to load the language needed by your custom code blocks. It will automatically
trigger a highlight update once loaded.

```js
import { extend } from '@markee/runtime'

await extend.prism.loadLanguage('rust')
await extend.prism.loadLanguage('graphql')
```

## Practical guidance

- keep hooks deterministic and synchronous
- avoid mutating input objects in place; return new objects
- keep them fast, especially search hooks, because they run on user input
