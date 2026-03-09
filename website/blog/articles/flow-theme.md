---
author: ellie
tags: Use Case
image: ../_images/article-2.webp
date: 2026-03-07
excerpt: "How the Flow theme uses Markee extension hooks and CSS scoping to provide layout-aware styling."
---

# Flow Theme: A Practical Theme-as-Extension Example

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


`@markee/theme-flow` demonstrates how a Markee theme can be packaged as a regular extension: head assets plus scoped CSS, with no custom build pipeline.

## Enable the theme

The project activates Flow with:

```yaml
theme: flow

extensions:
  - '@markee/theme-flow'
```

Markee then loads extension assets and applies selectors that target `body[data-theme="flow"]`.

## Extension contents

Flow is intentionally small:

- `_assets/_head/theme.css`
- `_assets/_head/fonts.html`

There is no required runtime JavaScript. Most behavior is implemented with CSS variables and data-attribute selectors.

## CSS structure

Flow styles are wrapped in `@layer markee-extension`.

This gives predictable cascade behavior:

- Markee base styles load first
- extension styles apply in their own layer
- project-level overrides can be added afterward

The theme scopes rules with these runtime hooks:

- `data-theme="flow"` for activation
- `data-color-scheme` for light/dark variants
- `data-layout` and section IDs for layout-specific rules

## Layout-aware theming

Markee publishes layout identity on `body[data-layout]`. Flow uses that signal to tune layout-specific parts (for example, docs sidebars) without splitting styles across multiple files.

The result is one stylesheet with explicit layout branches.

## Head assets and typography

`fonts.html` injects font declarations and `theme.css` defines visual tokens and component-level rules.

This separation keeps branding concerns in `_head` while layout composition remains in layout files.

## Safe customization strategy

To customize Flow without forking it:

- override `--markee-*` and `--mk-*` variables
- add another CSS layer after `markee-extension`
- scope custom rules to `body[data-theme="flow"]`

This approach keeps upgrades straightforward because upstream files remain unchanged.

## Takeaway

Flow is a clear reference for Markee theming: a theme is a distributable extension built from scoped assets and runtime-aware CSS, not a separate rendering system.
