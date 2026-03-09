---
version:
    name: Version 1
    date: 2025-04-24
---

# Versioning

Markee offers a way to version documents or folders. When multiple versions of a document or folder exist, only the latest
version appears in the navigation tree. When the document is displayed, a dropdown allowing to switch
version is displayed next to the top title.

:::tip
When building a custom layout, you can display the version dropdown using the 
[`markee-version-dropdown` preconfigured element](../layouts/preconfigured-elements.md#markee-version-dropdown).
:::

## Versioning a file

To version a file, you need to create a folder containing a `.version` file. That folder will be replaced
with the latest version of the file in the navigation tree.

The `.version` file is parsed as YAML, similar to [`.section` files](../navigation.md#pages-files), and can contain the
following fields:

- `mode`: whether to version as a file or as a folder. Defaults to `'file'` if omitted. For folder mode, see [Versioning a folder](#versioning-a-folder).
- `latestPathAlias`: additional path from which to serve the latest version. Defaults to empty string, which means the latest version will be accessible on the path of the containing folder.

If a `.version` file is found in a folder, all files in that folder, including inside subfolders, are considered
versions of that file. They will not appear in the navigation, instead they will populate the version dropdown
shown when rendering the file.

You can further customize how those versions behave by adding the `version` field in your front-matters, with
the following fields:

- `version.name`: name of the version in the current file. Will be displayed in the version dropdown. If unset, the document's title is used.
- `version.date`: date to use when ordering the version. Documents missing the `version.date` field will be sorted last, in alphabetical order

## Versioning a folder

Versioning a folder works similarly to versioning a file. Simply add the `mode: folder` property to the `.version`
file to let Markee know it should behave as a versioned folder.

When `mode` is set to `folder`, all direct subfolders will be considered as versions of the folder. You can control their
name and date through the `version` field of their respective `.section`, just like you would in the front-matter
of a versioned file.

:::warning
If a folder contains a `.version` file with `mode: folder`, any _file_ which is a direct descendant of that folder
will be ignored, and will not be included in the build.
:::

## Linking to versioned content

Markee enforces _filesystem-aware_ links, meaning that links between files should always resolve from a file-system
point of view, not from the after-build navigation structure. Because of that, it is not possible to use aliases
such as the latest alias for referring to files.

However, it can still be useful to be able to target the _latest version of a given file_ from another document.
For this reason, links to versioned content need an additional qualifier to tell Markee whether to treat it as a _fixed
version path_, or as a _latest version reference_.

```md
This is a [link to some versioned data latest entry](../versioned/v10/data.md){version=latest}
This is a [link to some versioned data specific version](../versioned/v7/data.md){version=fixed}
```

:::warning
Since neither the `latest` nor `fixed` version is more intuitive than the other, Markee will _reject unqualified links_
to versioned content. It will show a build error specifying that a version qualifier needs to be added to those links.
:::

If a link points to the latest version of a file, and a new version of the versioned folder is pushed without that file,
the build will fail and specify which link is now expired.

## Customizing behavior

You can customize various aspects of the versioning system behavior through [custom elements](../layouts/preconfigured-elements.md)
and styling hooks.

### Custom elements

The versioning system offers two custom elements you can use in your layouts:

- [`markee-version-dropdown`](../layouts/preconfigured-elements.md#markee-version-dropdown) renders a dropdown input for 
  selecting a document's version. It renders nothing when a non-versioned document is rendered. 
  It defaults to a `float: right` behavior and is intended to be put right before `markee-content` in your layout.
- [`markee-version-warning`](../layouts/preconfigured-elements.md#markee-version-warning) renders a warning call-out
  when a version different from the latest is rendered. The warning contains a link to the latest version.

  When a folder is versioned, if the currently displayed file exists in both the current and next selected 
  version, it is maintained. If not, then the first file found in the selected version will be selected in
  its place.

### Styling hooks

By default, when an older version of a document is loaded, the side-navigation
(rendered by [`markee-side-navigation`](../layouts/preconfigured-elements.md#markee-side-navigation)) will display
an indicator with a popover message for loading the latest version. You can target that indicator with the `[data-outdated]`
selector if you wish to hide it.
