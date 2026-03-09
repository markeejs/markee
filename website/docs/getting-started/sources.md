# Sources

Markee serves Markdown files and transforms them to HTML in the browser.
By default, Markee does not serve files until you tell it where your content lives.

You do this by declaring source roots: folders in your project that contain Markdown files.
Source roots are defined in your configuration file.

## Creating your configuration file

Several aspects of Markee can be configured to fit your specific needs. All configuration options can be
set through a central configuration file. This file should be at the root of your project, and be called
`markee.yaml` or `markee.yml`.

## Adding sources

You can define as many source folders as you need. For each source, Markee reads Markdown files in that folder and all subfolders.
It then builds navigation from the filesystem structure. You can later customize this structure in the
[navigation configuration](../configuration/navigation.md).

You define your sources by adding a `sources` array in the root of your configuration. Each source object follows this schema:

```yaml
  root: path/to/the/root/folder
  mount?: /mount/point/to/serve/files/on
  layout?: layout-name
```

### `root` parameter

<!-- sources-root-start -->
The `root` parameter is the only required parameter. It points to the folder in which your sources are located, relative
to your configuration file. For instance, if you have the following structure:

```bash
my-website/
  docs/
    index.md
  markee.yaml
  package.json
```

You can serve files in your `docs` folder with the following source:

```yaml
sources:
  - root: docs
```
<!-- sources-root-end -->

### `mount` parameter

<!-- sources-mount-start -->
By default, your sources will follow your navigation structure as-is. In the previous example, our source serves the `docs`
folder and its content; therefore it will be mounted on `/docs` and accessible on `http://localhost:8000/docs` with the default
development server.

If you need to mount your source elsewhere, you can do it through the optional `mount` parameter. A standard use-case for
this is when you only have one source, and want to mount it on the root path `/`:

```yaml
sources:
  - root: docs
    mount: /
```
<!-- sources-mount-end -->

### `layout` parameter

<!-- sources-layout-start -->
Markee provides a concept of _layouts_, which is a way to create reusable layouts shared between pages.

Some default layouts are available with Markee and inferred from your source root:

- If your source root is `docs`, the default layout will be `docs`
- If your source root is `blog`, the default layout will be `blog`
- If your source root is `pages`, the default layout will be `pages`
- For any other source root, the default layout will be `docs`

You can personalize the layout used by a given document in several ways. Here, the `layout` parameter of a source
changes the default layout for all documents in this root.

For instance, if you have both a documentation section and generic web pages, you can specify your layouts in your sources:

```yaml
sources:
  - root: pages
    mount: /
    layout: pages
  - root: docs
    mount: /docs
    layout: docs
```

You can learn more about layouts, including the default behaviors and how to customize them, in the [layouts documentation](../configuration/layouts/layouts.md).
<!-- sources-mount-end -->
