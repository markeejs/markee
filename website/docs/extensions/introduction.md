# Introduction

If you want to share some styles, scripts, or custom elements across multiple Markee projects, you can do it by
packaging them in an extension.

A Markee extension is an npm package with an `_assets` folder and an `extension.yaml` file at its root.
Set `main` in `package.json` to `extension.yaml`.

Any file you would normally put in the `_assets` folder of your website can be added to the `_assets` folder of an extension.
You can therefore easily share custom elements, styles, or even layouts.

## `extension.yaml`

The `extension.yaml` file should follow the syntax below:

```yaml
extensions?: string[] # list of other extensions this extension depends on
flatten?: string[]    # list of paths to mount on /_assets directly
```

## Layouts

See [our layouts guide](../configuration/layouts/layouts.md) to understand how extension layouts interact
with your local layouts.

## Non-scoped assets

By default, every asset put into the `_assets` folder of your extension will be available
on the `_assets/_extension/{your-extension}/_assets` path on the client site. Optionally, you can
configure paths which you want to be mounted directly on `_assets` instead.

You can do this by using the `flatten` field in your `extension.yaml`:

```yaml
flatten:
  - _assets/images # Will be mounted on _assets/images rather than _assets/_extension/{your-extension}/_assets/images
```

## Using an extension in your project

To use an extension in your project, install it in your `package.json` through your preferred package manager,
then add it to the `extensions` array of your [config file](../configuration/config-file.md#extensions):

```yaml
extensions:
  - @my-company/markee-preset
```

## Official packages

Official extension/theme packages documented in this section include:

- [Asciinema](./asciinema.md)
- [Diagrams](./diagrams.md)
- [MathJax](./mathjax.md)
- [LikeC4](./likec4.md)
- [Swagger UI](./swaggerui.md)
- [Kroki](./kroki.md)
- [Placeholders](./placeholders.md)
- [RevealJS](./revealjs.md)
- [Tooltips](./tooltips.md)
- [Flow Theme](./flow-theme.md)
