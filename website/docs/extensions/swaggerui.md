---
plugins:
  tabbedContent:
    linkTabs: false
---

# Swagger UI

The `@markee/swaggerui` extension renders OpenAPI specs with Swagger UI.

## Usage

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/swaggerui'
```

## Supported fences

The extension renders these fence styles:

- `openapi`
- `swagger`

## Basic example

:::tab[Example: openapi]

```openapi
openapi: 3.0.3
info:
  title: Orders API
  version: 1.0.0
paths:
  /orders:
    get:
      summary: List orders
      tags: [Orders]
      responses:
        '200':
          description: Order collection
  /orders/{id}:
    get:
      summary: Get order by id
      tags: [Orders]
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: openapi]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Filter by tag

Use `tag=` to keep only operations that include a specific OpenAPI tag.
Filtered renderings hide the generic API information and server sections.

:::tab[Example: tag]

```openapi tag=Pets
openapi: 3.0.3
info:
  title: Petstore API
  version: 1.0.0
tags:
  - name: Pets
  - name: Store
paths:
  /pets:
    get:
      operationId: listPets
      tags: [Pets]
      summary: List all pets
      responses:
        '200':
          description: OK
    post:
      operationId: createPet
      tags: [Pets]
      summary: Create a pet
      responses:
        '201':
          description: Created
  /pets/{petId}:
    get:
      operationId: getPet
      tags: [Pets]
      summary: Info for a specific pet
      responses:
        '200':
          description: OK
  /orders:
    get:
      operationId: listOrders
      tags: [Store]
      summary: List orders
      responses:
        '200':
          description: OK
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        tag:
          type: string
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: tag]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Filter by operation

Use `operation=` to keep a single operation.
Filtered renderings hide the generic API information and server sections.

Supported selectors:

- operationId, for example `operation=listPets`
- method + path, for example `operation="GET /pets"`
- method:path, for example `operation=get:/pets`

:::tab[Example: operation]

```openapi operation="GET /pets"
openapi: 3.0.3
info:
  title: Petstore API
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      tags: [Pets]
      summary: List all pets
      responses:
        '200':
          description: OK
    post:
      operationId: createPet
      tags: [Pets]
      summary: Create a pet
      responses:
        '201':
          description: Created
  /pets/{petId}:
    get:
      operationId: getPet
      tags: [Pets]
      summary: Info for a specific pet
      responses:
        '200':
          description: OK
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: operation]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Filter by schema

Use `schema=` to show only one schema from `components.schemas`.
When `schema=` is set, the extension hides operations and focuses on models.
Filtered renderings hide the generic API information and server sections.

:::tab[Example: schema]

```openapi schema=Pet
openapi: 3.0.3
info:
  title: Petstore API
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      tags: [Pets]
      summary: List all pets
      responses:
        '200':
          description: OK
components:
  schemas:
    Pet:
      type: object
      required: [id, name]
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        tag:
          type: string
    Order:
      type: object
      properties:
        id:
          type: integer
        petId:
          type: integer
```

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: schema]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Direct element usage

You can also use `markee-swaggerui` directly with a `src` attribute.
The file can be JSON or YAML.

:::tab[Example: src attribute]

::markee-swaggerui{src=./includes/petstore-v3.1.json}

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: src attribute]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::
:::tab[Example: src + filter]

::markee-swaggerui{src=./includes/petstore-v3.1.yaml tag=pets}

:::
:::tab[Source]

~~~md
{%
include-self
start ":::tab[Example: src + filter]"
end ":::"
preserve-includer-indent false
preserve-delimiters false
%}
~~~

:::

## Metadata handling

- `id` and `class` are applied to the wrapper `markee-swaggerui` element.
- `tag`, `operation`, and `schema` are reserved filter attributes.
- Use only one filter attribute per fence (`tag` or `operation` or `schema`).
- Custom Swagger UI options are intentionally not supported.
