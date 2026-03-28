# Markee

Markdown-first website generator for documentation, blogs, and other content-heavy sites.

Markee starts from folders of Markdown files, then layers on filesystem routing, reusable layouts, client-side navigation, and shareable extensions built on web standards.

## Why Markee

- Files and folders become routes without a separate router config.
- Layouts are section-based, so docs, blog, and landing pages can coexist in one site.
- Markdown stays the primary authoring format.
- Themes and extensions package layouts, scripts, styles, and runtime hooks for reuse.
- The generated site is static-output friendly while still supporting dynamic client behavior.

## Quick Start

Create a site with your preferred package manager:

```bash
pnpm create markee
```

Then install dependencies and start the dev server:

```bash
cd my-markee-site
pnpm install
pnpm exec markee dev
```

You can also use `npm create markee`, `yarn create markee`, or `bun create markee`.

## Minimal Example

```yaml
# markee.yaml
title: Acme Docs
theme: flow

sources:
  - root: pages
    mount: /
  - root: docs
    mount: /docs

extensions:
  - '@markee/theme-flow'
```

```text
pages/
  index.md
docs/
  getting-started.md
_assets/
  _header.md
  _layouts/
    docs/
      left.md
```

## Main Packages

- `create-markee`: project scaffolder for new Markee sites.
- `@markee/cli`: build, dev server, preview server, and project initialization.
- `@markee/runtime`: runtime helpers for custom scripts and extensions.
- `@markee/vite`: Vite plugin for bundling Markee-compatible extension assets.
- `@markee/theme-flow`: official theme used by the documentation site.

The repo also contains lower-level packages for search, state, Markdown pipelines, built-in elements, and official extensions.

## Repository Layout

- `packages/core`: CLI, browser client, and runtime entrypoints.
- `packages/domains`: search, state, elements, and Markdown pipeline building blocks.
- `packages/extensions`: official optional extensions such as diagrams, Swagger UI, MathJax, and tooltips.
- `packages/support`: helper packages for scaffolding, Vite, Vitest, TypeScript, and shared config.
- `packages/themes`: official themes.
- `website`: the Markee documentation site and local playground for the monorepo.

## Local Development

Install dependencies:

```bash
pnpm install
```

Useful commands from the repo root:

```bash
pnpm start
pnpm build
pnpm site:build
pnpm site:preview
```

- `pnpm start` runs the client and CLI in watch mode against the local `website/`.
- `pnpm build` builds all workspace packages that expose a build step
- `pnpm site:build` builds the documentation website
- `pnpm site:preview` previews the built documentation website

## Documentation

- Docs site: https://markee.dev/
- Source for the docs site: `website/`

If you are looking for package-specific usage, start with the README of the package you are consuming directly.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, development workflow, validation steps, and release-related contribution guidelines.
