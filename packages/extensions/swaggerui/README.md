# @markee/swaggerui

Markee extension for OpenAPI rendering with Swagger UI.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/swaggerui
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/swaggerui'
```

Then write an OpenAPI spec in an `openapi` or `swagger` fence:

```openapi
openapi: 3.0.3
info:
  title: Orders API
  version: 1.0.0
paths:
  /orders:
    get:
      summary: List orders
      responses:
        '200':
          description: OK
```

You can also filter the rendered output with fence meta such as `tag=Pets`, `operation="GET /pets"`, and `schema=Pet`.

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the browser assets required to render interactive Swagger UI documentation.
