---
title: Flow
---

# Flow Theme

`@markee/theme-flow` is an official Markee theme package.
It is the theme used by the Markee documentation website.

The default theme shipped with the client is intentionally minimalist, so it stays easy to customize and use as a starting point.
If you want a ready-made theme with more visual polish, and you like the look of the official docs, use Flow.

## Installation

```
npm install @markee/theme-flow
```

```yaml title="markee.yaml"
theme: flow
extensions:
  - '@markee/theme-flow'
```

## What it provides

The package ships:

- `_assets/_head/theme.css`
- `_assets/_head/fonts.html`

Once enabled, styles are applied through `body[data-theme="flow"]` selectors.

## Customization

You can customize Flow without forking it by layering your own overrides:

- override CSS variables in your own `_assets/_head/*.css`
- add more specific selectors under `body[data-theme="flow"]`
- keep Flow enabled as a base extension and add local project styles on top
