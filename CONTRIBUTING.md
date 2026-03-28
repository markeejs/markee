# Contributing to Markee

Thanks for contributing!

This guide covers the practical workflow for working on the Markee monorepo: setup, local development, validation, and release-facing changes.

## Prerequisites

- Node.js 24
- `pnpm` 9.1.1

The workspace is configured around `pnpm`, so use that as the default package manager when contributing locally.

## Repository Layout

- `packages/core`: CLI, browser client, and runtime entrypoints
- `packages/domains`: state, search, Markdown pipeline, and built-in elements
- `packages/extensions`: official extensions
- `packages/support`: helper packages for scaffolding, Vite, Vitest, TypeScript, and shared tooling
- `packages/themes`: official themes
- `website`: documentation site and local playground for the monorepo

## Getting Started

Install dependencies from the repository root:

```bash
pnpm install
```

## Local Development

Run the main local development workflow:

```bash
pnpm start
```

This starts the client and CLI in watch mode against the local `website/` project.

Other useful commands:

```bash
pnpm test
pnpm lint
pnpm lint:tsc
pnpm build
pnpm site:build
pnpm site:preview
```

- `pnpm test` runs the workspace test suites
- `pnpm lint` runs formatting, linting, and dependency consistency checks
- `pnpm lint:tsc` runs TypeScript checks across the workspace
- `pnpm build` builds all workspace packages that expose a build step
- `pnpm site:build` builds the documentation website
- `pnpm site:preview` previews the built documentation website

If you only need to work on a single package, prefer filtered commands:

```bash
pnpm -F @markee/cli test
pnpm -F @markee/diagrams build
pnpm -F @markee/client dev
```

## Working on the Website and Docs

The documentation site lives in `website/`.

Use it as the main integration environment for:

- testing CLI and runtime changes
- validating extension behavior
- checking docs updates
- verifying theme and layout changes

If your change affects public behavior, update the relevant docs and package README in the same pull request whenever practical.

## Quality Expectations

Before opening a pull request, run the checks that match your change. For most code changes, that means:

```bash
pnpm lint
pnpm lint:tsc
pnpm build
pnpm test
```

Please also:

- add or update tests for behavior changes
  - we strive for 100% codebase coverage; but focus on test quality over quantity
- keep changes scoped to the task
- avoid unrelated refactors in the same pull request
- update docs when the public API, config, behavior, or developer workflow changes

## Coding and Repository Conventions

- Keep package boundaries clear. Prefer changing the narrowest package that owns the behavior.
- Use the existing workspace tooling rather than introducing one-off commands or duplicate config.
- Follow the established TypeScript, Vitest, and Vite patterns used in sibling packages.
- Prefer small, reviewable pull requests over large mixed changes.

## Changesets and Releases

Markee uses Changesets for releases.

Add a changeset when your pull request changes a published package in a way that should be released, for example:

- new features
- bug fixes
- behavior changes
- public API changes

You usually do not need a changeset for:

- docs-only changes
- test-only changes
- CI-only changes
- changes limited to private internal tooling that is not published

Create a changeset with:

```bash
pnpm exec changeset
```

Notes:

- public `@markee/*` packages are versioned together through a fixed Changesets group
- `create-markee` is also published and should get a changeset when its released behavior changes

## Pull Requests

A good pull request usually includes:

- a clear description of the problem and the change
- tests or a note explaining why tests were not needed
- documentation updates when contributor-facing or user-facing behavior changed
- a changeset when a published package should be released

If your change affects multiple packages, explain the dependency between them in the PR description.

## Questions and Ambiguity

If you are unsure where a change belongs, start by tracing the owning package from the current implementation and the docs site under `website/`.

When in doubt, prefer the smallest change that keeps the public surface coherent.
