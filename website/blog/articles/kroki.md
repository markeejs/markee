---
author: ellie
tags: Use Case
image: ../_images/article-3.webp
date: 2026-03-07
excerpt: "Using the Kroki extension in Markee, including runtime rendering, caching, and optional build-time prerendering."
---

# Kroki in Markee: Runtime Rendering and Optional Prerender

:::warning
This article has been written by an AI, for demonstration purposes only.
It can contain errors or inaccurate information.
:::


The Kroki extension is a concrete example of a full Markee extension flow: Markdown transformation, custom element rendering, shared state usage, and optional build-time payload generation.

## Authoring syntax

After installing `@markee/kroki`, diagrams are written as fenced code blocks with a diagram language and a `kroki` marker:

~~~markdown
```mermaid kroki
graph TD;
A-->B;
```
~~~

Use the fence language to select the Kroki engine (`mermaid`, `plantuml`, `dbml`, and others).

## Required plugin configuration

Kroki needs a server endpoint:

```yaml
plugins:
  kroki:
    serverUrl: 'https://kroki.io/'
```

If `serverUrl` is missing, the extension reports a clear runtime error.

## Runtime rendering path

Without prerendering, the extension converts matching fences into `<markee-kroki>` elements.

Each element:

- resolves diagram engine and source
- reads plugin configuration from `state.$pluginConfig`
- requests SVG from the configured Kroki server
- renders returned SVG inline

The resolver serializes requests through an internal queue to reduce bursty parallel traffic.

## Caching behavior

The extension uses two cache layers:

- in-memory cache for source and request reuse during the session
- IndexedDB cache (`markee::kroki`) for persisted SVG reuse across navigations

Repeated diagrams can therefore render without repeated network fetches.

## Build-time prerender mode

You can preload diagrams during build:

```yaml
plugins:
  kroki:
    serverUrl: 'https://kroki.io/'
    prerender: true
```

With `prerender: true`, the extension's build plugin resolves SVG during `markee build` and stores payloads in Markdown metadata.

At runtime, `<markee-kroki>` can read SVG directly from `state.$payload`, avoiding network calls for prerendered diagrams.

## Why this extension matters

Kroki is a useful reference when implementing rich fenced-block features because it combines:

- Markdown plugin hooks
- optional build-time preload logic
- runtime custom elements
- shared state integration (`$pluginConfig`, `$payload`)

The same pattern applies to many domain-specific block types beyond diagrams.
