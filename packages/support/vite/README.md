# @markee/vite

Vite helpers for building Markee extension bundles.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add -D @markee/vite vite
```

## Usage

```ts
import { defineConfig } from 'vite'
import { markee } from '@markee/vite'

export default defineConfig({
  plugins: [markee()],
})
```

## What `markee()` Configures

The plugin applies the defaults expected by Markee extension bundles:

- `base: './'` for relative runtime chunk loading
- `build.outDir: '_assets/_head'`
- `build.rollupOptions.input: ['src/main.ts']`
- externalization of runtime packages already exposed through Markee import maps
- `_`-prefixed non-entry chunk filenames so lazy chunks are not auto-injected as top-level head scripts
