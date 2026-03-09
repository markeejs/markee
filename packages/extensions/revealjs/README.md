# @markee/revealjs

Markee extension for RevealJS presentations.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/revealjs
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/revealjs'
```

Then use the documented custom blocks:

```markdown
::::reveal-js{style="height:36rem"}
:::reveal-slide
First slide
:::
:::reveal-slide
Second slide
:::
::::
```

Use `data-config` for RevealJS options and `data-layout=raw` when you want to disable the default layout transforms.

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the browser assets required to render RevealJS slide decks.
