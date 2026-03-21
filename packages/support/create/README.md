# create-markee

Project scaffolder for creating a new Markee site.

Full Markee documentation at https://markee.dev/

## Introduction

The scaffold delegates to `@markee/cli` and walks you through an interactive setup that:

- creates or updates `package.json`
- writes a `markee.yaml` configuration file
- helps you define initial content sources

When it finishes, it prints the dependency installation command for your package manager.

## Usage

```bash
npm create markee@latest
pnpm create markee
yarn create markee
bun create markee
```

## Notes

This package delegates to `@markee/cli` and is the recommended entrypoint for bootstrapping a new Markee project.
Bun is also supported; when launched through Bun, it will use Bun as its runtime automatically.
