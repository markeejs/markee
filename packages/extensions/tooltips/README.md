# @markee/tooltips

Markee extension for turning title attributes into tooltips.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/tooltips
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/tooltips'
```

After that, elements with a `title` attribute are rendered with tooltips automatically:

```md
[This link has a title](# "My title")

[This paragraph has a title]{title="Title on paragraph"}
```

Set `plugins.tooltips.footnotes: true` if you want tooltip rendering for footnote references.

## Notes

This package ships a Markee extension bundle through `extension.yaml` and the assets required to replace plain title attributes with Markee tooltip UI.
