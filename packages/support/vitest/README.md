# @markee/vitest

Shared internal Vitest helpers for Markee workspace packages.

## What It Provides

`@markee/vitest` standardizes test configuration across Markee packages.

It exposes:

- `createMarkeeVitestConfig()` for a shared base Vitest config
- `installMarkeeVitestSetup()` for common DOM and browser test setup

## Example

```ts
import { defineConfig } from 'vitest/config'
import { createMarkeeVitestConfig } from '@markee/vitest'

export default defineConfig(createMarkeeVitestConfig())
```

This package is intended for Markee workspace packages rather than external consumers.

It is not published on NPM.
