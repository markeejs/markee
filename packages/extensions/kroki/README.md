# @markee/kroki

Markee extension for using Kroki as a diagram rendering backend.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/kroki
```

## How to use

Add the extension to your `markee.yaml` and configure a Kroki server:

```yaml
plugins:
  kroki:
    serverUrl: 'https://kroki.io/'

extensions:
  - '@markee/kroki'
```

Then use fenced code blocks with `<engine> kroki`:

```mermaid kroki
graph TD
  A --> B
```

You can also enable build-time prerendering with `plugins.kroki.prerender: true`.

## Notes

This package ships a Markee extension bundle through `extension.yaml` and the static assets needed to integrate Kroki-backed diagram rendering into a site.
