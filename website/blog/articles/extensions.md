---
author: jeremie
tags: Feature
image: ../_images/article-6.webp
date: 2026-03-07
excerpt: "How Markee extensions package layouts, assets, and plugin hooks for reuse across projects."
---

# Packaging Reusable Features with Markee Extensions

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


Markee extensions provide a packaging model for shared layouts, styles, scripts, and plugin logic.

If multiple projects repeat the same `_assets` customizations, an extension is usually the right place to move that code.

## Extension shape

At minimum, an extension is an npm package with:

- an `_assets` directory
- an `extension.yaml` file
- `package.json` pointing `main` to `extension.yaml`

```json
{
  "name": "@my-org/markee-preset",
  "main": "extension.yaml"
}
```

Anything valid in project-level `_assets` can also be shipped by an extension.

## Loading and dependency chaining

Projects enable extensions in `markee.yaml` under `extensions:`.

An extension can declare additional dependencies in its own `extension.yaml`:

```yaml
extensions:
  - '@my-org/markee-base'
```

Markee resolves these transitively, so nested extension trees are loaded as a set.

`@markee/default` is always included to provide baseline layouts and shared UI pieces.

## Asset namespacing and flattening

By default, extension assets are mounted under:

`/_assets/_extension/<extension-name>/...`

`extension.yaml` can expose selected paths directly under `/_assets` with `flatten` when consumers should not depend on the extension's internal path structure.

## Layout reuse

Extensions can include complete layouts in `_assets/_layouts/...` and shared `_header` / `_footer` sections.

Consumers can then:

- use extension layouts directly
- override specific local sections
- reference extension sections with YAML `extends`
- combine extension defaults with local overrides through `default.yaml`

This supports shared conventions while keeping project-level control.

## Build and runtime hooks

Extensions can provide executable hooks in addition to static assets:

- `_assets/_build/*.js|*.mjs` for build-time preload plugins
- `_assets/_head/*.js|*.mjs` for client runtime behavior (custom elements, Markdown plugins)

Markee discovers these automatically. `_`-prefixed files are treated as utilities and excluded from automatic registration.

## Team packaging strategy

A practical split for internal ecosystems:

- `base` preset: design tokens, typography, shared header/footer, global scripts
- `domain` preset: docs/blog layouts and components
- project `_assets`: product-specific overrides

This keeps shared behavior centralized without blocking local adaptation.

## Summary

Markee extensions are simple packages with predictable merge behavior and first-class integration into layout resolution, build processing, and client runtime.
