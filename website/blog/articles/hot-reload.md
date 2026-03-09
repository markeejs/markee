---
author: ellie
tags: Feature
image: ../_images/article-8.webp
date: 2026-03-07
excerpt: "How Markee hot reload coordinates file watching, cache invalidation, SSE events, and client revalidation."
---

# Hot Reload in Markee: Targeted Updates During Development

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


Markee development mode is designed to avoid full rebuilds on every change. It coordinates server-side invalidation and client-side revalidation so most edits are reflected immediately.

## Server flow: detect changes and emit events

The dev server watches project files (plus optional extra watch folders).

When a change is detected, Markee:

- invalidates affected caches
- recomputes Markdown and metadata views as needed
- refreshes layout references
- emits an SSE `fileChange` event on `/_markee/sse`

The goal is to invalidate only what changed while preserving correctness.

## Client flow: revalidate state and assets

The browser maintains an `EventSource` connection to the SSE endpoint.

On `fileChange`, the client:

- revalidates head assets
- clears relevant client caches
- refreshes metadata stores (`config`, `navigation`, `layouts`, `search`)

It also reconnects automatically after transient failures and pauses update work when the tab is hidden.

## What can be hot-swapped

### Markdown documents

Changed Markdown files are fetched again and rendered through the same pipeline used during normal navigation.

### `_assets/_head` scripts and styles

Head assets are reloaded. Module scripts are imported with cache-busting parameters to guarantee fresh code execution.

### Custom element implementations

In development mode, Markee patches custom element registration so updated definitions can replace existing instances when possible.

For that reason, extension code should avoid strict one-time registration guards that block replacement.

## When Markee performs a full reload

Some updates are not safely swappable (for example, certain inline head fragments). In those cases, Markee performs a full page reload.

The fallback favors deterministic behavior over partial, potentially stale updates.

## Interaction with build-time plugins

If your project uses `_assets/_build` plugins, dev mode also refreshes preload outputs for affected Markdown.

When preloading work is heavy, Markee may briefly serve a preloading marker until recomputation completes.

## Practical result

In typical content workflows, this architecture keeps feedback loops short while preserving a consistent runtime state model.
