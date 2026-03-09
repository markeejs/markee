# Navigation

By default, Markee builds its navigation system by following the folder structure inside your sources. 
For instance, if we take the following structure:

```go
docs/
  content-authoring/
    advanced-features.md
    basic-markdown-syntax.md
    custom-blocks.md
  getting-started/
    installation.md
    sources.md
  index.md
```

Then Markee will serve the Markdown files at URLs matching their path on the filesystem:

```go
/docs/content-authoring/advanced-features
/docs/content-authoring/basic-markdown-syntax
/docs/content-authoring/custom-blocks
/docs/getting-started/installation
/docs/getting-started/sources
/docs
```

Default Markee elements such as `markee-side-navigation` and `markee-mobile-navigation` follow the navigation ordering
created by the Markee CLI. So, the generated navigation tree looks like this:

```
- Docs
    - Content authoring
        - Advanced features
        - Basic markdown syntax
        - Custom blocks
    - Getting started
        - Installation
        - Sources
```

However, this is not always what you want. Sometimes you may want a different order or a
different section name than the one inferred from the corresponding folder. To do this, you can use `.section` files inside your
folders to influence their names and internal navigation.

## `.section` files

Whenever you need to control how a folder behaves in the navigation, just add a `.section` file in it.

In this file, you can input configuration options using the YAML format. Navigation options are inspired by the
[awesome-pages plugin](https://github.com/lukasgeiter/mkdocs-awesome-pages-plugin) for MkDocs.

:::info[`.pages` alias]{collapsed}
Because `.section` files were inspired by `awesome-pages`, the alias `.pages` is also supported.
:::

Here are the fields you can use to customize your navigation tree:

### `title`

Use the `title` option to rename the section created from that folder. For instance, if we wanted to use titlecase,
we could add the following files:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
```
:::
:::tab[/docs/getting-started/.section]
```yaml
title: Getting Started
```
:::

We could also use that to rename the Docs section altogether, adding a `.section` file at the root of our source:

:::tab[/docs/.section]
```yaml
title: Learn Markee
```
:::

### `collapsible`

This configuration option is used internally by the [`markee-side-navigation`](layouts/preconfigured-elements.md#markee-side-navigation)
element. It controls whether the section should appear as collapsible (default behavior) or not in the displayed navigation
tree. Set that value to `false` to force the section in an expanded state.

You can also set the default behavior for all sections as a data attribute for the `markee-side-navigation` element.

### `meta`

The `meta` field lets you set default values to be injected in all descendant files' [`frontMatter`](front-matter.md).

You can use it to set default tags or authors, or to change the layout used by files inside a folder. Values set directly
in a file's front-matter will always take precedence. If nested folders define their own `meta` field, both fields are
shallow-merged together with the deeper folder taking precedence for any duplicated field.

### `hidden`

The `hidden` flag is used to remove folders from the navigation. All files and subfolders are also hidden.
However, they are still accessible if their URL is known.

`hidden: true` impacts all descendants, meaning all `hidden` flags set in subfolders or descendant files 
of this folder will be ignored and forced to `true`.

### `indexable`

The `indexable` flag decides whether the files inside that folder should be indexed for search. By default, it is
equal to the inverse of `hidden`, so that hidden files are automatically removed from search. You can force a folder
and its content to be indexable through `indexable: true`, so that they are searchable even when hidden; or you can
force a folder and its content out of the search index through `indexable: false`, so that they are available through
navigation trees, but not through search.

`indexable` is inherited but can be overridden, so if a subfolder or a file inside a folder with `indexable: false` has
its own `indexable: true` flag, its content will still get indexed. Similarly, if a folder forces `indexable: true`,
a descendant can still opt out of the index by setting its own `indexable: false` flag.

### `draft`

The `draft` field also allows hiding sections, but they work a bit differently from the `hidden` flags:

- In development mode, or when building the website with the `--mode preview` flag, draft files and folders will be
  visible in the navigation and accessible to be read
- In production mode without `--mode preview` flag, draft files and folders will be completely
  omitted from the build. So, they will not be visible in the navigation and will not be accessible even if their URL is known.

`draft: true` impacts all descendants, meaning all `draft` flags set in subfolders or descendant files
of this folder will be ignored and forced to `true`.

### `order`

The `order` field determines the ordering of files and folders when default navigation or rest patterns are used.
Can be either `asc` or `desc`, and defaults to `asc` if omitted.

### `navigation`

You can use the `navigation` field to customize the way files and folders inside a folder will be named and ordered, or
even which will show and which will not.

In its simplest form, you can pass it an array of files and folders, and only those files and folders will be integrated
in the tree.

For instance, if we only wanted `basic-markdown-syntax.md` to show in the `content-authoring` folder, we could use the
following configuration:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - basic-markdown-syntax.md
```
:::

#### Rest entries

You can optionally put a `...` entry to insert all files and folders not specifically named. Markee will first place
all the files and folders you specified, then insert the rest wherever the first `...` entry is found in your array.

For instance, the following will put `basic-markdown-syntax.md` on top, `advanced-features.md` at the end, and whichever
other files and folders will be put in between in their default order (folders first, files and folders alphabetically sorted).

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - basic-markdown-syntax.md
  - ...
  - advanced-features.md
```
:::

You can also specify a glob or regular expression pattern on your rest entries. Rest entries with a glob or regex will be run first, 
in order. Then, if any files are remaining and there is a generic rest entry, the remaining files will be inserted there.

You can use this to keep folders on top, and insert files somewhere, for instance:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - ...         # Folders will be inserted here
  - basic-markdown-syntax.md
  - ... | *.md  # All files (matching *.md) will be inserted here 
                # before the generic rest parameter is consumed
  - advanced-features.md
```
:::

To evaluate your pattern as a regular expression rather than a glob, simply prefix it with either `regexp=` or `regex=`.
You can also prefix it with `glob=` to make it explicit it is a glob:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - basic-markdown-syntax.md
  - ... | *.md             # Will use a glob
  - ... | glob=*.md        # Will use a glob
  - ... | regex=^.*\.md$   # Will use a regular expression
  - ... | regexp=^.*\.md$  # Will use a regular expression
  - advanced-features.md
```
:::

:::tip
Regular expression patterns will only match the direct siblings to the `.section` file.

Glob patterns can match deeply using `**/`, or can match _below_ using `../`.

If a glob pattern matches deeply, results do not keep their folder structure. Instead, they are applied
flat to the current folder. So, it is recommended to only use it in combination with `.md` matching
to make sure to limit the matches entries to files, not folders.
:::

Finally, you can specify a custom ordering for a rest entry. Simply append `| desc` or `| asc` at the end of your entry:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - basic-markdown-syntax.md
  - ... | *.md             # Will sort by 'asc' (default)
  - ... | desc             # Will sort by 'desc'
  - ... | *.md | asc       # Will sort by 'asc'
  - advanced-features.md
```
:::

#### Named entries

By default, the name used for a file in the tree will be inferred from its front-matter, and for a folder
from its name or its own `.section` file.
However, in some situation you may want to use a different name in the navigation tree, for instance to use a shorter name.

To do that, simply prefix your file (or folder) with the new title you want to give it, followed by `:`. You can
mix and match renamed entries and entries with their default names.

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - Basic syntax: basic-markdown-syntax.md # Will use "Basic syntax" as a name
  - custom-blocks.md                       # Will use its default name
  - advanced-features.md                   # Will use its default name
```
:::

#### Virtual sections

You can also use `navigation` to add virtual sections grouping files without creating folders on your filesystems.

To do that, simply add a named entry in your navigation, containing its own list of entries:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - Syntax:
      - basic-markdown-syntax.md
      - advanced-features.md
  - Others:
      - custom-blocks.md
```
:::

You can combine virtual sections with all other features from the `navigation` field, including named entries and rest entries:

:::tab[/docs/content-authoring/.section]
```yaml
title: Content Authoring
navigation:
  - Folders:
      - ...
  - Files:
      - ... | *.md
```
:::

#### Manually defined tree

Finally, you can use the `navigation` entry to manually define a whole tree or subtree. To do so, use the [Virtual sections](#virtual-sections)
syntax with actual folder names as names of your sections.

You can either directly set the navigation list for a subfolder, or add more metadata as you would in a `.section`.

For instance, this site's navigation structure could have been described in the `/docs/.section` file as follows:

:::tab[/docs/.section]
```yaml
navigation:
  - getting-started:
      title: Getting Started
      navigation:
        - installation.md
        - sources.md
  - content-authoring:
      title: Content Authoring
      navigation:
        - basic-markdown-syntax.md
        - custom-blocks.md
        - advanced-features.md
        - icons-and-emojis.md
  - configuration:
      - config-file.md
      - front-matter.md
      - navigation.md
      - layouts:
          - default-layouts.md
          - preconfigured-elements.md
      - versioning
  - customizing:
      - styles.md
      - scripts:
          - shared-state.md
          - elements.md
          - ui-primitives.md
          - markdown-plugins.md
          - extend-hooks.md
          - bundling.md
      - metadata.md
      - build-time.md
  - extensions:
      - introduction.md
      - Extensions:
          - ...
      - Themes:
          - ... | *theme.md
```
:::
