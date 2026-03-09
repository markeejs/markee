# @markee/placeholders

Markee extension for placeholder variable support.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/placeholders
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/placeholders'
```

Then use placeholders in text:

```md
Use `world`{placeholder} in this sentence.
Use `readonly`{variable} for a read-only value.
```

Inside code blocks, use the `placeholders` modifier and bracket syntax:

```bash placeholders
echo "Hello [world]{placeholder}"
```

Use `::markee-placeholder-inputs` to generate inputs for all placeholders on the page.

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the client code needed to resolve and render placeholder-driven content.
