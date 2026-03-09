---
author: jeremie
tags: Feature
image: ../_images/article-5.webp
date: 2026-03-07
excerpt: "A technical overview of Markee's Markdown features, metadata model, and extension hooks."
---

# Markdown in Markee: Extended Authoring with a Structured Pipeline

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


Markee uses Markdown as its primary authoring format, then layers directives, includes, metadata enrichment, and plugin hooks on top of it.

The goal is to keep source files readable while supporting advanced documentation use cases.

## Base syntax and extensions

Markee supports standard Markdown plus common documentation-oriented extensions:

- block attributes (`{.class #id key=value}`)
- directives (`::note`, `::tab[...]`, `::div{...}`)
- icon and emoji shorthands
- include directives for reusable content

These features allow structured UI patterns without leaving Markdown.

## Includes for reuse and source-of-truth docs

Include syntax supports snippet reuse and source extraction.

Typical use cases:

- share legal notes or setup steps across multiple pages
- embed code snippets from canonical source files
- include only selected ranges while preserving indentation behavior

This reduces duplication and keeps prose synchronized with implementation.

## Two-stage processing

Markdown is processed in two stages:

- build-time sanitation and metadata preparation in the CLI
- client-side Markdown-to-HTML rendering through the Remark/Rehype pipeline

The split supports both static preprocessing and runtime features.

## Front matter and inferred metadata

Markee reads front matter and enriches file metadata with inferred values:

- title inference from first heading or filename
- reading-time estimation
- folder-level inheritance from `.section` metadata
- file-level layout overrides

The resulting metadata feeds layout selection, navigation, and search.

## Draft behavior by environment

Draft content is environment-aware:

- development/preview: draft blocks and files are available
- production: draft content is excluded

This makes staged publishing possible without separate branches.

## Extending syntax with plugins

`@markee/runtime` allows custom pipeline behavior:

- register Remark plugins
- register Rehype plugins
- resolve plugin config from global settings and file front matter

Teams can introduce domain-specific Markdown semantics while staying inside the same rendering pipeline.

## Summary

Markee's Markdown model combines readable source text, reusable include mechanics, and explicit extension points. It is designed for long-lived documentation where maintainability matters as much as rendering features.
