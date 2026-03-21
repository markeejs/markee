# @markee/client

Browser client application bundled into generated Markee sites.

Full Markee documentation at https://markee.dev/

## Introduction

This package contains:

- the browser app shell rendered by generated Markee sites
- the public assets copied into builds
- the import-map aware Vite build used by Markee during development and production
- development-mode entrypoints used by the local dev server

## When To Use It

Most Markee projects should not depend on `@markee/client` directly.
It is installed by default as a dependency of `@markee/cli`.

It is mainly useful when you are working on Markee core itself.

For normal site development, install and run `@markee/cli` instead.
