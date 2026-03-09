# Preconfigured Elements

To help you create your own layouts without having to write too much basic logic from scratch,
Markee offers a set of preconfigured elements you can use to add functionalities to your website.

## `markee-content`

This element can be rendered anywhere to tell Markee where to insert the document contents inside a layout.

Be careful not to include it multiple times, since each `markee-content` instance will render the document contents,
which can lead to rendering errors.

### Options

 - **`data-heading-anchors: boolean | string`**: whether to add an anchor next to each heading, allowing easy copy of that
    heading link. Defaults to `false`.
    ::br
    If set to `true`, a default HTML content will be generated for the anchor. It will display a `:fa-link:` (:fontawesome-link:)
    by default.
    ::br
    If set to a `string`, that string will be used as the HTML content for the anchor.
    

### Usage

```markdown title=_assets/_layouts/docs/main.md hl_lines=1 line_numbers
::markee-content
::markee-revision-date
```

## `markee-side-navigation`

The `markee-side-navigation` element renders a navigation tree for your website's content. By default, it will
render every document from all your sources.

You can also configure some aspects of the rendered tree through `data` attributes.

### Options

 - **`data-filter: boolean`**: whether to show a _filter_ input on top of the tree (between the root title and the elements),
    allowing users to filter entries shown to more easily find their way in big trees. Defaults to `false` if omitted.
 - **`data-hide-root: boolean`**: when set, the title of the root folder for which the tree is displayed will not be added on
    top of the tree. Defaults to `false` when omitted.
 - **`data-root-segments: number`**: allows you to target a specific depth to start your tree at. By default, the value will
    be `1`, meaning that the root of the tree is the root of your website, and all sources are visible.
    If set to `2`, then the website's root will be skipped, and the tree will start at the root of the source where the
    current document is situated. If set to higher than `2`, the tree will be started at the corresponding parent folder
    of the current document.
 - **`data-min-root-segments: number`**: allows you to specify the minimum number of root segments required for the current
    file to display the menu. If the current file is lower in the tree than the specified number of segments, the menu will
    be empty.
 - **`data-default-expanded: boolean`**: if set, all collapsible sections will start expanded. Otherwise, all collapsible
    sections will start collapsed, excepted parents of the current document which will be expanded (so that the current document
    is always visible in the tree). Defaults to `false.`
 - **`data-default-collapsible: boolean`**: controls whether sections are marked as collapsible by default or not. When omitted,
    all sections are marked as collapsible by default, and you can toggle it off for a specific section by setting `collapsible: false`
    in its `.section`. When explicitly set to `false`, all sections are marked as non-collapsible by default, and you can toggle it _on_ for
    a specific section by setting `collapsible: true` in its `.section`.
 - **`data-min-entry-width: string`**: CSS size string setting the minimum width an entry can reach before its text is broken into
    multiple lines.
 - **`data-white-space: string`**: CSS `white-space` value for the entries, allowing you to force all entries to never split
    in multiple lines.

### Usage

```markdown title=_assets/_layouts/docs/left.md
::markee-side-navigation{data-hide-root data-root-segments=2 data-default-collapsible=false}
```

### Advanced filtering

Sometimes, simply filtering by root segments is not enough for your needs. In this case,
you can set `extend.navigation.filterTree` (from `@markee/runtime`).
The function receives two parameters: `tree` and `rootTree`. `tree` corresponds to the tree
that would be rendered if the function was not set; `rootTree` corresponds to the complete
tree if `root-segments` was left to `1`.

The function should return an object following the same format as the `tree` parameter. You are
free to filter, reorder, nest your documents as you want in the structure your return.

The type of the `filterTree` parameters and return value is `TreeItem`:

```ts
interface TreeLeaf {
    key: string
    label: string
    link: string
}

interface TreeItem {
    key: string
    label: string
    collapsible?: boolean
    items?: (TreeItem | TreeLeaf)[]
    link?: string
}
```

See [Runtime Hooks](../../customizing/scripts/extend-hooks.md) for complete usage guidance and examples.

## `markee-mobile-navigation`

In the same fashion as `markee-side-navigation`, `markee-mobile-navigation` displays
a navigation tree for your website. However, it does not render the tree in place; instead,
it renders a burger menu button. When clicking the button, a side-panel is displayed
either on the left or right of the screen, containing the tree.

The tree is not made of nested lists with collapsible sections, rather it
is displayed one section at a time with a back button on top to go up the tree one level.

The bottommost level of the tree, which opens by default, displays the table of contents
of the current document.

For convenience, when using the default theme, the `markee-mobile-navigation` element has a `display: none` by
default, meaning the burger menu will not be visible. It's up to you to set its
display back to `block` at the breakpoint at which you want it to show.

### Options

- **`data-root-segments: number`**: allows you to target a specific depth to start your tree at. By default, the value will
  be `1`, meaning that the root of the tree is the root of your website, and all sources are visible.
  If set to `2`, then the website's root will be skipped, and the tree will start at the root of the source where the
  current document is situated. If set to higher than `2`, the tree will be started at the corresponding parent folder
  of the current document.
- **`data-position: 'left' | 'right'`**: which side of the screen the panel should appear on. Defaults to `'right'`.
- **`data-toc-depth: 3 | 4 | 5 | 6`**: the max header depth displayed in the table of contents. Defaults to 6.

### Usage

```markdown title=_assets/_header.md hl_lines=1
::markee-mobile-navigation{data-root-segments=1}
# [My Website](/)
```

## `markee-table-of-contents`

Use the `markee-table-of-contents` element to draw a table of contents for your document.
The table of contents will display links to each of the headers in your document, and it will
follow the scroll of the page to indicate which sections are already passed, and which are currently active.

### Options

- **`data-depth: 3 | 4 | 5 | 6`**: the max header depth displayed in the table of contents. Defaults to 6.
- **`data-title: string`**: the title displayed above the table of contents. Defaults to `Table of Contents`.
    You can also set it to `false` to remove the title completely.

### Usage

```markdown title=_assets/_layouts/docs/right.md
::markee-table-of-contents{data-depth=4}
```

## `markee-previous-article` and `markee-next-article`

The `markee-previous-article` element can be used to display a link or information about the document right
before the current one in the navigation tree.

The `markee-next-article` element can be used to display a link or information about the document right
after the current one in the navigation tree.

### Options

- **`data-article-element: string`**: the name of a custom element you defined
  somewhere in your custom scripts, which you want to use to display articles.
  See [Custom article element](#custom-article-element) below. Defaults to an internal
  element displaying a simple link to the document around its title.

### Usage

```markdown title=_assets/_footer.md
:::div{.siblings}
::markee-previous-article{data-article-element=sibling-article}
::markee-next-article{data-article-element=sibling-article}
:::
```

## `markee-article-list`

The `markee-article-list` element can be used to display a list of documents
following certain filtering rules. Moreover, the element used to display each
article in the list can be customized through a `data` attribute, giving you
a lot of control over how your documents are rendered. By default, if you do not
provide an article element, a simple link to the document will be rendered around
its title.

### Options

- **`data-article-element: string`**: the name of a custom element you defined
    somewhere in your custom scripts, which you want to use to display articles.
    See [Custom article element](#custom-article-element) below. Defaults to an internal
    element displaying a simple link to the document around its title.
- **`data-empty-element: string`**: the name of a custom element you defined
    somewhere in your custom scripts, which you want to display when there are
    no articles matching your filters. You can pass it `span` if you just want to
    display nothing. Defaults to an internal element displaying `No article found` in a `span`.
- **`data-order: 'path' | 'title' | 'date'`**: the ordering method you want to use for your list.
    Defaults to `date`, which will order your documents based on their most specific
    modification date (in order, `frontMatter.modificationDate`, `frontMatter.date`, `revisionDate`).
    You can also prefix the value with either `+` (default) or `-` to control the direction of the sorting.
- **`data-limit: number`**: max number of document to display at once. If omitted, all documents
    will be displayed. If set to a number, the list will be truncated to the first N documents.
- **`data-page-size: number`**: if set, the list will get paginated with N documents per page.
    The list will receive a `data-page` attribute corresponding with the one-indexed number of the
    page currently displayed.
    The page will be synced as a `page` search parameter on the current URL.
- **`data-page-lead: boolean`**: if set, the first page of a paginated list will get N+1 document instead of N.
    The first document will receive a `data-lead` attribute which can be used for styling.
- **`data-filter-folder: string`**: allows you to select a folder (relative to the root of your website) in
    which documents must be to be included in the list. Useful if you only want to list documents of
    a specific folder.
    ::br 
    Can be combined with other filter attributes. Only articles matching _all_ filter attributes
    will be displayed.
- **`data-filter-tag: string`**: allows you to specify a tag which articles must have to be included
    in the list. Tags matching is case-insensitive.
    ::br
    You can also prefix your entry with either `any:` or `all:` and provide a list of semicolon separated values. If prefixed
    with `any:` then any article matching one of the tags will be included. If prefixed with `all:`, then only articles
    matching all the provided tags will be included.
    ::br
    Can be combined with other filter attributes. Only articles matching _all_ filter attributes
    will be displayed.
- **`data-filter-author: string`**: keeps only articles written by the specified author. Author
    matching is case-insensitive.
    ::br
    You can also prefix your entry with either `any:` or `all:` and provide a list of semicolon separated values. If prefixed
    with `any:` then any article written by one of the authors will be included. If prefixed with `all:`, then only articles
    written by all the provided authors will be included.
    ::br
    Can be combined with other filter attributes. Only articles matching _all_ filter attributes
    will be displayed.
- **`data-filter-same: Multiple values`**: Special filter allowing to keep only articles which relate
    to the currently displayed document in some way. When using `data-filter-same`, the current document
    will always be omitted.
    ::br
    Can be combined with other filter attributes. Only articles matching _all_ filter attributes
    will be displayed.
    ::br
    Possible values are:
  - `'folder'`: will keep only documents in the same folder as the current document, including subfolders.
  - `'root:${number}`: will keep only documents sharing the same first N path segments with the current document.
  - `'authors:first'`: will keep only documents written by the _first_ author of the current document.
  - `'authors:any'`: will keep only documents written by _at least one_ author of the current document.
  - `'authors:all'`: will keep only documents written by _all the authors_ of the current document. Matches can have more authors.
  - `'authors:exactly'`: will keep only documents written by _exactly the same authors_ as the current document. Matches _cannot_ have more authors. Order does not matter.
  - `'tags:first'`: will keep only documents tagged with the first tag of the current document.
  - `'tags:any'`: will keep only documents with at least one tag in common with the current document.
  - `'tags:all'`: will keep only documents tagged with _all the tags_ of the current document. Matches can have more tags.
  - `'tags:exactly'`: will keep only documents tagged with _exactly the same tags_ as the current document. Order does not matter.
    ::br
    You can specify multiple values by separating them with semicolons, for instance `data-filter-same=authors:first;tags:first` will only
    match articles with the same first tag **and** the same first author.

### Usage

```markdown title=_assets/_layouts/blog-list/main.md
::markee-article-list{data-filter-same=folder data-page-size=10 data-article-element=blog-article-card}
```

### Custom article element

If you want to define your own custom element for displaying your articles,
you can use the `article` variable in the element's `dataset` to get the file key
of the article. You can then look up the document's information in the `state.$navigation.get().files`
variable.

Here is an example custom element fetching the image, excerpt and reading time estimate
of an article to display it as a nicer card:

```js
import { state } from '@markee/runtime'

class BlogArticleCard extends HTMLElement {
  connectedCallback() {
    const articleId = this.dataset['article']
    const article = state.$navigation.get().files[articleId]

    const image = document.createElement('img')
    const imageAnchor = document.createElement('a')
    const title = document.createElement('h2')
    const titleAnchor = document.createElement('a')
    const excerpt = document.createElement('p')
    const readingTime = document.createElement('p')

    imageAnchor.append(image)
    titleAnchor.append(title)

    title.textContent = article.frontMatter.title
    excerpt.textContent = article.frontMatter.excerpt
    readingTime.textContent = Math.round(article.readingTime) + ' minutes read'
    image.src = article.frontMatter.image

    imageAnchor.href = article.link
    titleAnchor.href = article.link

    this.role = 'article'
    this.append(imageAnchor, titleAnchor, excerpt, readingTime)
  }
}

customElements.define('blog-article-card', BlogArticleCard)
```

## `markee-search`

The `markee-search` element provides a default implementation of a search
bar for your site. Internally, it uses the [`state.$search`](../../customizing/scripts/shared-state.md#search)
state function to match documents against queries.

It then displays the results in a floating window above your content.

### Options

- **`data-placeholder: string`**: input placeholder text.
- **`data-icon: string`**: icon class for the search icon. Defaults to `fa fa-search`.
- **`data-results-page: string`**: optional route to open on `Enter` with `?q=<query>`.

### Extension hooks

`markee-search` can be customized through `extend.search`, with `import { extend } from '@markee/runtime'`:

- `getShardingKeys?: () => string[]`: split search across predefined key shards.
- `groupResults?: (results) => results | { sectionName, results }[]`: group rendered search results into sections.

See [Runtime Hooks](../../customizing/scripts/extend-hooks.md) for when to use each hook and implementation examples.

### Usage

```markdown title="_assets/_header.md" hl_lines=3
::markee-mobile-navigation{data-root-segments=1}
# [My Website](/)
::markee-search
```

## `markee-color-scheme-manager`

The `markee-color-scheme-manager` element let your users control the color-scheme in which your website is displayed.
The schemes will cycle between `auto`, `light` and `dark`.

It displays an icon representing the currently selected color scheme.

### Options

- **`data-title-auto`**: `title` attribute to use when the current theme is `auto`. Defaults to `'System theme'`.
- **`data-title-light`**: `title` attribute to use when the current theme is `light`. Defaults to `'Light theme'`.
- **`data-title-dark`**: `title` attribute to use when the current theme is `dark`. Defaults to `'Dark theme'`.
- **`data-base-class`**: base class to set to the element, shared across all schemes. Use it to select your 
  [icon pack](../../content-authoring/icons-and-emojis.md). Defaults to `'fa fa-solid'`.
- **`data-class-auto`**: supplementary class to enable when the current scheme is `auto`. Defaults to `'fa-circle-half-stroke'`
- **`data-class-light`**: supplementary class to enable when the current scheme is `light`. Defaults to `'fa-sun'`
- **`data-class-dark`**: supplementary class to enable when the current scheme is `dark`. Defaults to `'fa-moon'`

### Usage

```markdown title="_assets/_header.md" hl_lines=4
::markee-mobile-navigation{data-root-segments=1}
# [My Website](/)
::markee-search
::markee-color-scheme-manager
```

## `markee-document-suggestion`

The `markee-document-suggestion` element allows you to propose a list of documents which `link` attribute loosely
resemble the current displayed path. It is useful to provide alternatives when reaching a 404.

### Options

 - **`data-limit: number`**: maximum number of suggestions to display.

### Usage

```markdown title=_assets/_layouts/404/main.md hl_lines=7
# Document Not Found

We couldn't find the document you are looking for!

## Did you mean?

::markee-document-suggestion{data-limit=5}
```

## `markee-revision-date`

Displays the current document's revision date in a human-readable format.

### Options

- **`data-label: string`**: customize the label shown before the date. Defaults to `'Last updated: '`
- **`data-lang: string`**: language to use with [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) to display the human-readable date.
- **`data-format: string`**: a JSON representation of `Intl.DateTimeFormat` [`options`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options)

### Usage

```markdown title=_assets/_layouts/docs/main.md hl_lines=2 line_numbers
::markee-content
::markee-revision-date
```

## `markee-contribute`

Allows displaying contribution/edition links for the website or dedicated pages, if `repository` is set in `markee.yaml`.
If `repositoryRoot` is set, it is appended when generating target URLs. This is useful if the root of your Markee site
is not the root of the repository.

### Options

- **`data-root: boolean`**: whether to display the root site edition link (when set), or the current file edition link (if omitted).
- **`data-hint: string`**: hint to display as a tooltip on mouse hover.
- **`data-label: string`**: in root site mode, label to use for the link. Defaults to the repository link.
- **`data-icon: string`**: class to use as icon, defaults to `fa fa-pen` in file mode, and `si si-github` in root site mode.

### Usage

```markdown
<!-- Current file rendering -->
::markee-contribute

<!-- Root site rendering -->
::markee-contribute{data-root}

<!-- Custom label -->
::markee-contribute{data-root data-label="Contribute!"}

<!-- Custom content, will drop the icon and ignore the label -->
:::markee-contribute{data-root}
:simple-github: my-website
:::
```


## `markee-version-dropdown`

Renders a dropdown input for selecting a document's version. It renders nothing when a non-versioned document is rendered.
It defaults to a `float: right` behavior and is intended to be put right before `markee-content` in your layout.

### Options

- **`data-title: string`**: label to use in parentheses to denote the latest version. Defaults to `'Latest'`. Set to an empty string to remove the label completely.

### Usage

```markdown hl_lines=1
::markee-version-dropdown{data-title=Current}
::markee-content
```


## `markee-version-warning`

Renders a warning call-out when a version different from the latest is rendered. The warning contains a link to the latest version.

### Options

- **`data-title: string`**: adds a title to the call-out.

### Usage

```markdown hl_lines=1
::markee-version-warning{data-title="Outdated version"}
::markee-version-dropdown
::markee-content
```
