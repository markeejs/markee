# Bundling Scripts

If your custom scripts grow beyond small inline modules, bundle them before publishing.
This is especially useful for extensions, where TypeScript, modern syntax, and multiple source files are common.

For Markee projects, [Vite](https://vite.dev/) is the recommended bundling tool.

A bundler like [Vite](https://vite.dev/) lets you:

- write scripts in TypeScript
- use modern syntax and language features
- split code into multiple source files and emit one or more runtime bundles

## Keep sources outside `_assets`

Markee auto-discovers JavaScript files in `_assets/_head` and injects them.

Because of that behavior:

- put your **source files** outside `_assets` (for example in `src/`)
- emit only the **built artifacts** into `_assets/_head`

This avoids sideloading development sources at runtime.

A typical extension structure looks like this:

```text
my-extension/
  extension.yaml
  package.json
  src/
    index.ts
  _assets/
    _head/
      bundle.js
```

## Externalize Markee import-map packages

Markee already exposes several packages through import maps at runtime.
When bundling, mark them as `external` so they are **not** bundled again.

This avoids duplicate code and ensures those dependencies are resolved through runtime imports.

Packages to externalize:

- `@markee/runtime`
- `nanostores`
- `@nanostores/persistent`
- `@nanostores/lit`
- `lit` and `lit/*`

## Build to ESM output

The output bundle should stay in ESM format to match Markee's module loading model.

## Set `base: './'` for runtime chunk loading

When your bundle uses dynamic imports, Vite emits additional chunks.

Set `base: './'` so those chunks are loaded relative to the entry script location.
Without this, chunk requests are resolved from `/`, which breaks when scripts are served from `_assets/...`.

## Prefix non-entry chunks with `_`

Markee auto-injects files found in `_assets/_head`.
To avoid injecting lazy chunks as top-level head scripts, prefix generated non-entry chunk files with `_`.

## Recommended setup: `@markee/vite`

Use `@markee/vite` to apply the recommended defaults automatically:

- `base: './'`
- `build.outDir: '_assets/_head'`
- `build.rollupOptions.input: ['src/main.ts']`
- Markee import-map externals
- prefixed non-entry chunks (`assets/_[name]-[hash].js`)

```ts
import { defineConfig } from 'vite'
import { markee } from '@markee/vite'

export default defineConfig({
  plugins: [markee()],
})
```

## Practical notes

- Even during `markee dev`, you will need to rebuild your bundle manually. Markee will only load
  built assets. But Markee's hot-reload will work upon rebuilding.
- If you output multiple bundles, keep all of them under `_assets/_head`.
- Prefix support files that should not be directly injected in `<head>` with `_`.
