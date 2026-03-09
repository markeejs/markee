---
author: jeremie
tags: Feature
image: ../_images/article-4.webp
date: 2026-03-07
excerpt: "A detailed look at Markee layout composition, inheritance, override rules, and runtime rendering hooks."
---

# Markee Layouts Under the Hood

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


Markee layouts are section-based compositions rather than monolithic templates. Each section can be local, inherited, or extension-provided, and can be authored in Markdown, HTML, or YAML composition references.

This article explains the model, resolution rules, and runtime hooks.

## Core layout model: seven sections

A rendered page is assembled from up to seven sections:

::::block[div]{.sections}
::div[Header _#markee-header_]{.header}
::div[Top _#markee-section-top_]{.top}
:::block[div]{.markee-main}
::em[#markee-main]{#test}
::div[Left _#markee-section-left_]{.left}
::div[Main _#markee-section-main_]{.main}
::div[Right _#markee-section-right_]{.right}
:::
::div[Bottom _#markee-section-bottom_]{.bottom}
::div[Footer _#markee-footer_]{.footer}
::::

<style>
.sections {
    display: grid;
    grid-template:  "header" 1fr
                    "top" 1fr
                    "markee" 3fr
                    "bottom" 1fr
                    "footer" 1fr / 1fr;
    width: 100%;
    gap: 0.25rem;
    margin-bottom: 2rem;

    div {
        border: 3px solid rgba(0,0,0,0.1);
        border-radius: 0.5rem;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: bold;
        flex-direction: column;
        text-align: center;
        padding: 0.5rem;

        em {
            font-size: 0.7em;
        }
    }

    .markee-main {
      display: grid;
      gap: 0.25rem;
      grid-template:
            "title title title" auto
            "left main right" 1fr / 1fr 2fr 1fr;
      border: 3px solid rgba(0,0,0,0.1);
      border-radius: 0.5rem;
      padding: 0.25rem;

      > em {
        grid-area: title;
        font-size: 0.7em;
      }

      > div {
        height: 100%;
      }
    }

    .header { grid-area: header; background-color: var(--mk-admonition-background-danger); color: var(--mk-admonition-color-danger); }
    .top { grid-area: top; background-color: var(--mk-admonition-background-warning); color: var(--mk-admonition-color-warning); }
    .left { grid-area: left; background-color: var(--mk-admonition-background-hint); color: var(--mk-admonition-color-hint); }
    .main { grid-area: main; background-color: var(--mk-admonition-background-default); color: var(--mk-admonition-color-default); }
    .right { grid-area: right; background-color: var(--mk-admonition-background-hint); color: var(--mk-admonition-color-hint); }
    .bottom { grid-area: bottom; background-color: var(--mk-admonition-background-warning); color: var(--mk-admonition-color-warning); }
    .footer { grid-area: footer; background-color: var(--mk-admonition-background-danger); color: var(--mk-admonition-color-danger); }
}
</style>

`left`, `main`, and `right` are wrapped by `#markee-main`.

In practice, only `main` is essential. If no explicit `main` section is provided, Markee inserts `<markee-content></markee-content>` automatically.

## Layout file locations

Layout assets are discovered from `_assets`:

```text
_assets/
  _header.md
  _footer.html
  _layouts/
    docs/
      left.md
      main.md
      right.md
    blog/
      main.md
    landing/
      top.html
      main.md
      default.yaml
```

Rules:

- shared sections: `_assets/_header.*` and `_assets/_footer.*`
- layout-specific sections: `_assets/_layouts/<layout>/<section>.*`
- valid section names: `top | left | main | right | bottom`

## Layout selection order

Layout resolution applies these layers (highest precedence last):

1. source-level default in `markee.yaml`
2. inferred fallback (`pages` -> `pages`, `blog` -> `blog`, otherwise `docs`)
3. inherited `.section` `meta.layout`
4. file front matter `layout`

When no route matches a file, Markee uses layout `404`.

## Section formats: Markdown, HTML, YAML

Section files can be:

- `*.md` for Markdown-rendered sections
- `*.html` for direct HTML insertion
- `*.yaml` / `*.yml` for reference-based composition

YAML files are useful for reuse across layouts and extensions.

### Reuse from another local layout

```yaml
layout: docs
section: left
```

### Reuse from an extension

```yaml
extends: '@markee/default'
layout: docs
section: right
```

### Set extension defaults for missing sections

`_assets/_layouts/docs/default.yaml`:

```yaml
extends: '@markee/default'
```

Then define only local overrides.

## Important detail: custom `main`

When you provide a custom `main.md` or `main.html`, automatic content insertion is disabled.

To render page content, include:

```markdown
::markee-content
```

Without this marker, only your explicit section content is rendered.

## Runtime hooks and DOM contract

`markee-root` renders a stable shell and injects resolved sections by fixed IDs.

Useful hooks:

- `body[data-layout="..."]` reflects the active layout
- section IDs remain stable (`#markee-section-left`, `#markee-section-main`, etc.)

Example:

```css
body[data-layout="docs"] #markee-section-left {
  border-right: 1px solid var(--mk-border-color);
}
```

## Summary

Markee layouts are designed for incremental complexity: start with defaults, override one section at a time, and move to fully custom compositions only when needed.
