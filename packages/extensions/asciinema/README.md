# @markee/asciinema

Markee extension for rendering Asciinema recordings.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/asciinema
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/asciinema'
```

Then point an image to a `.cast` file:

```md
![](./includes/demo.cast)
```

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the assets and client code required to embed Asciinema content in a site.
