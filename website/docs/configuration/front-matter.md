# Front-matter

Your files can start with a front-matter which allows you to enrich them with useful
metadata.

## Front-matter syntax

To add a front-matter to your file, simply start your file with a fenced
block between `---`. The block should contain YAML content.

```markdown
---
description: This file contains a front-matter
tags:
    - front-matter
    - metadata
    - awesomeness
---

# Document title

My document content
```

:::tip
If your front-matter contains a non-object value (such as a single string or number),
it will automatically be wrapped in an object and set on the `default` key.
:::

## Sharing metadata between files

Sometimes you have a group of files that need some common metadata. You can define
metadata at the folder level rather than directly inside file. In this case, every
files inside this folder will inherit those metadata.

To do so, you can use the [`.section`](./navigation.md#meta) file of a folder.

If some metadata field is define at a folder level, defining it again in a file
will override its value for that file.

## Available metadata

Here is the list of all default metadata you can add to a file. They are all optional.

### `title`

You can define a title for your document through its front-matter. If omitted, the
main heading of your document will be used as title. If present and your document
is missing a main heading, the front-matter title will be inserted as the main heading.

If you have both a title in the front-matter _and_ a main heading, then:

- the main heading will be rendered as the title of the document when reading it;
- the front-matter title will be used everywhere else: in search results, RSS feeds, navigation trees...

### `description`

Allows you to provide a description of the contents of your document. It will be used
as a fallback value for the `excerpt` field.

### `tags`

Lets you define tags for your document. Can either be a string or an array of strings, but will
always end up parsed as an array.

Tagging documents is useful in multiple cases:
- You can use tags in search queries. Tags have a higher ranking score than content by default, 
  and can be matched explicitly to allow for fine-grained search capability
- Tags can be used for filtering articles. This can be used for [generating RSS feeds](./config-file.md#rss),
  or to filter articles shown by the [`markee-article-list` custom element](./layouts/preconfigured-elements.md#markee-article-list).

### `authors`

Lets you define authors for the document. As for tags, it can be either a single string or an array
of strings, parsed as an array.

Document authors can be used for filtering, like tags. You can also retrieve document
authors to display them with a [custom element](../customizing/scripts/elements.md) for your [layouts](./layouts/layouts.md).

### `date` and `modificationDate`

`date` can be used to manually assign a date to your document. This is useful for
[generating RSS feeds](./config-file.md#rss), which order document by date, or to
use the [`markee-article-list` custom element](./layouts/preconfigured-elements.md#markee-article-list).

You can also provide a `modificationDate` if you want to keep track of the initial date
of a document, but use an updated date for sorting.

In order, date-sorting algorithm will use:

- `modification`, if found;
- or `date`, if found;
- or _date of the last commit_; if available;
- or _date of the last file modification on disk_.

`date` and `modificationDate` both accept string and number values.
It should be a valid single-value accepted by the [JavaScript Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date) constructor.

### `image`

Link to an image file in your website to be used as an image for your document.
By default, it is not used by any pre-configured Markee features. However, it is
provided for any extension you might want to build. In the client, reading the `image`
field from a file's front-matter will return a _resolved URL_, following any split you
might have configured.

### `excerpt`

The `excerpt` field is meant to be used when displaying your articles in a list.
By default, it is not used by any pre-configured Markee features.

An `excerpt` field will always be present in your parsed front-matter, even if you
did not put one manually.

If you provided a `description` field and no `excerpt` field, the `description` value
will be copied into the `excerpt` field.

If you provided neither an `excerpt` field nor a `description` field, an excerpt will
be inferred automatically by extracting the first 200 letters of paragraph content in your
document.

### `layout`

By default, all files inherit their `layout` from their source. However, you can
specify a different layout for a specific file through the `layout` field in its
front-matter.

If you want to apply a different layout to a whole folder, use its use the [`.section`](./navigation.md#meta) file instead.

You can [learn more about layouts](./layouts/layouts.md) in the dedicated section.

### `hidden`

Add the `hidden` boolean flag to `true` if you want your file to be
omitted from navigation trees and search indexes. The file will still be accessible through its
URL if it is known.

### `indexable`

The `indexable` boolean flag decides whether the file should be indexed for search or not. If omitted,
it defaults to the inverse of `hidden`, meaning that hidden files are not findable through search,
only their URL.

If you want to omit a file from navigation trees but still have it findable through search, set `indexable: true`
explicitly.

### `draft`

Add the `draft` boolean flag to `true` if you want your file to be omitted
from production builds. In development, or if the build is run with the `--mode preview`
flag, the file will be visible in navigation tree, indexed for search, and accessible through its URL.
A banner will be shown on top of the flag to indicate that it is in a draft state.
In production builds run without the `--mode preview` flag, the file will be
omitted completely, neither visible from navigation trees nor accessible
through its URL or search.

### `plugins`

Allows you to control how some plugins from the Markdown-to-HTML pipeline behave
for this file. See the [plugins options](config-file.md#plugins) from the global
configuration file for more info.

## Custom metadata

You can add any other field to your metadata if you want. They will be parsed
and made accessible from the [navigation state object](../customizing/scripts/shared-state.md#navigation),
and you can use them in your extensions and layouts.

