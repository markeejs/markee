# @markee/pipeline

Client-side Markdown pipeline for Markee built on remark and rehype.

Full Markee documentation at https://markee.dev/

## What It Exports

This package exports the two main pipeline entrypoints used inside Markee:

- `clientPipeline` for Markdown-to-HTML rendering in the browser
- `searchPipeline` for preparing searchable content snippets

It also contains the remark/rehype plugins and extension glue used by Markee's runtime pipeline.

## Notes

This is an internal package used by `@markee/client`.
