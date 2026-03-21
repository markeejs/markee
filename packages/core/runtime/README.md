# @markee/runtime

Extension entrypoints and runtime exports for Markee-generated sites.

Full Markee documentation at https://markee.dev/

## Introduction

`@markee/runtime` is the package extension authors typically consume from Markee scripts.

It exposes:

- `extend` for runtime hooks and Markdown pipeline extensions
- `state` for access to shared Markee stores
- `MarkeeElement` for building custom elements on top of Lit
- `BooleanConverter` and other small runtime helpers

It is exposed through an import map by the client-side bundle.
You do not need to install that package manually; it comes as a
dependency of `@markee/cli`.

## Example

```ts
import { extend, MarkeeElement } from '@markee/runtime'

extend.search.getShardingKeys = () => ['^/docs/', '^/blog/']

class DemoBadge extends MarkeeElement {}
DemoBadge.tag('demo-badge')
```

## Notes

Markee sites consume this package transitively through `@markee/cli`.

Install it directly when you are authoring extensions for typing/autocomplete support.
