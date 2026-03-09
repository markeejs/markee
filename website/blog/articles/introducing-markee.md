---
author: jeremie
tags: Release
image: ../_images/article-1.webp
date: 2026-03-08
excerpt: "An overview of Markee's Markdown-first architecture, including ES Modules, import maps, custom elements, layouts, and extensions."
---

# Introducing Markee: A Markdown-First Content Engine

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


Markee is a documentation and content engine for teams that prefer Markdown authoring but still need modern client behavior and reusable UI structure.
Its runtime builds on web platform standards, including ES Modules, import maps, and Web Components (custom elements), rather than a framework-specific rendering model.

Its design is centered on five ideas:

- route generation from the file system
- composable layout sections
- a shared client state model
- extension-based customization
- standards-based runtime primitives

This article gives a technical overview of how those pieces fit together.

## Route generation from folders

Markee maps files and folders to URLs.

You declare source roots in `markee.yaml`:

```yaml
sources:
  - root: pages
    mount: /
  - root: docs
    mount: /docs
  - root: blog
    mount: /blog
```

Each file becomes a routable page under its mount point. You do not maintain a separate route table.

## Layouts as independent sections

Pages render into a fixed section model: `header`, `top`, `left`, `main`, `right`, `bottom`, `footer`.

Sections can be authored in Markdown or HTML, inherited from extensions, and overridden at multiple levels (source, folder via `.section`, file front matter). This allows one project to host documentation, blog content, and custom landing pages without duplicating template logic.

## A two-stage Markdown pipeline

Markee splits content processing into two stages:

- build-time processing for sanitation, metadata extraction, and preload hooks
- client-side Markdown-to-HTML rendering (Remark/Rehype based) for runtime behavior

This model keeps authoring simple while allowing extension points at build and runtime.

## Built on modern web standards

Markee's client runtime uses standards that are broadly supported in modern browsers:

- ES Modules for script loading and dependency boundaries
- import maps for browser-side module resolution
- Web Components/custom elements for reusable UI behavior

This keeps extension code portable and reduces coupling to a specific frontend framework.

## Shared client state for navigation and UI

Client code can subscribe to atoms from `@markee/runtime`, including `$router`, `$currentFile`, `$currentLoader`, `$navigation`, and `$search`.

Built-in components and custom extensions use the same stores, which keeps navigation and page-level metadata consistent across the application.

## Extensions as reusable packages

A Markee extension is an npm package with `extension.yaml` and `_assets`.

Extensions can contribute:

- scripts and styles
- layouts and reusable sections
- build-time plugins (`_assets/_build`)
- transitive dependencies on other extensions

This package model is intended for reusable presets that can be shared across teams or projects.

## Development loop

In development mode, Markee watches content and assets, invalidates affected caches, refreshes metadata, and emits update events over SSE.

The browser revalidates state and swaps head assets or custom element code when possible. When safe hot-swap is not possible, Markee falls back to full reload.

## Summary

Markee is built for sites that start as Markdown collections but grow into systems with shared layouts, dynamic UI behavior, and reusable platform conventions.
