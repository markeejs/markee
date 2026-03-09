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
