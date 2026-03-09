---
author: ellie
tags: Feature
image: ../_images/article-7.webp
date: 2026-03-07
excerpt: "How Markee's shared state coordinates routing, metadata loading, layout resolution, and extension behavior."
---

# Inside Markee's Shared State

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


Markee exposes a client state API through `@markee/runtime` for routing, metadata access, layout resolution, and plugin-aware behaviors.

The implementation is built on [nanostores](https://github.com/nanostores/nanostores), with a stable wrapper that surfaces higher-level atoms and helpers.

## Why shared state is required

Markee sites rely on soft navigation, dynamic layout composition, search, and custom elements. Multiple UI areas need synchronized access to:

- current route and active file
- metadata (`config`, `navigation`, `layouts`, `search`)
- layout section resolution and rendered content state
- color scheme and theme preferences

`state` provides that synchronization contract.

## Public API surface

Import state in client code:

```js
import { state } from '@markee/runtime'
```

Common atoms:

- `$router`: route state and navigation helpers
- `$config`: loaded `markee.yaml` configuration
- `$currentFile`: metadata for the route-matched file
- `$currentLoader`: loading/data/error state for resolved content
- `$navigation`: files, folders, and computed tree helpers
- `$search`: search API with composable filters
- `$colorScheme`: persisted `auto | light | dark` value

Helper composition APIs:

- `state.combine([...])`
- `state.compute([...], transform)`

## Metadata loading behavior

Markee lazily fetches metadata JSON from `/_markee/*.json` using loader stores that expose `loading`, `data`, `error`, and `refresh()`.

Important behaviors:

- split-aware merge: if metadata is split, all fragments are fetched and merged
- single-flight refresh: concurrent `refresh()` calls share one in-flight promise
- boot refresh: stores are revalidated during startup

This allows early subscriptions without race-condition-heavy client code.

## `$currentFile` versus `$currentLoader`

Markee separates document identity from document readiness:

- `$currentFile` updates immediately when a route maps to a file
- `$currentLoader` updates when content and layout sections are resolved

Use `$currentFile` for metadata-driven UI and `$currentLoader` for work that requires rendered content.

```js
state.$currentLoader.subscribe((loader) => {
  if (loader.loading || !loader.data) return
  console.log('Loaded file key:', loader.data.key)
  console.log('Resolved layout:', loader.data.layout)
})
```

If no file matches the path, Markee resolves and loads the `404` layout through the same loader path.

## Layout and content resolution

During navigation, Markee resolves:

1. file content (rendered through the Markdown pipeline)
2. layout sections (`header`, `footer`, `top`, `left`, `main`, `right`, `bottom`)

If `main` is not explicitly defined, Markee falls back to:

```html
<markee-content></markee-content>
```

`$currentLoader` is the runtime source of truth consumed by `markee-root`.

## Navigation tree utilities

`$navigation` includes raw metadata and a computed tree with helper methods such as:

- `getBranchByKey`
- `getAncestorsForKey`
- `reload`

The tree maintains parent links and version-aware rewriting, and caches key lookups for interactive UI components.

## Search as part of state

`$search` exposes a function API and operates on weighted searchable fields (`tags`, `title`, `label`, `content`) with normalization and prefilter support.

Example:

```js
const search = state.$search.get()
const byTags = search.anyOf('tags', ['feature', 'release'])
const results = await search('layout', { filters: [byTags] })
```

Results are grouped by file and can be highlighted through Markee's search rendering pipeline.

## Advanced plugin-facing atoms

Two less visible APIs are useful in extension code:

- `$payload.for({ plugin, element })`: resolve payload data for a plugin element, including layout payloads
- `$pluginConfig.for(pluginName)`: resolve plugin configuration with file-level overrides over global settings

These helpers reduce duplicated lookup logic in custom elements.

## Recommended usage patterns

For extension and custom UI code:

- subscribe to `$currentLoader` for page-ready behavior
- use `$currentFile` for immediate metadata access
- derive narrow signals with `state.compute`
- navigate via `$router.get().navigate.open()`
- reuse `$search` and `$navigation.tree` instead of rebuilding indexes

## Summary

Markee's shared state API is intentionally compact but covers the full runtime lifecycle: route changes, metadata loading, layout resolution, and plugin integration.
