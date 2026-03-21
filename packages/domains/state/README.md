# @markee/state

Nanostores-powered state layer for the Markee site generator.

Full Markee documentation at https://markee.dev/

## Introduction

This package exports the shared Markee state facade together with:

- router state
- metadata loaders
- current-file and layout state
- search state
- navigation tree state
- cache helpers for runtime fetching

## Notes

This is an internal package used by `@markee/client`.

It is not intended to be consumed outside of `@markee/client`. To access
Markee's state in a custom script, prefer `@markee/runtime`.
