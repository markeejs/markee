# Default Layouts

When you start a new Markee site, some layouts are automatically configured on your behalf.

You don't have to use them, of course. And since they are shared through an extension, you can
always override them with your own layouts if you want to reuse the name.

Here are the predefined layouts, and how they behave:

## `docs`

The `docs` layout, also used as default layout when not specified explicitly for a file, is composed of a `left`,
`main` and `right` section.

The `left` section renders a [`markee-side-navigation`](./preconfigured-elements.md#markee-side-navigation)
element with the `root-segments` option set to `2` so that it focuses only on one source at a time, displaying
a navigation tree for all the files in the source.

The `right` section renders a [`markee-table-of-contents`](./preconfigured-elements.md#markee-table-of-contents) element,
displaying a table of contents for all headers in the current document.

The `main` section renders your document content, as well as some basic style to have a nicer padding.

## `blog`

The `blog` layout is a very simple layout featuring only your document content in a `main` section. It also includes
some basic style to have a nicer padding.

## `blog-list`

The `blog-list` layout can be used to display the index page of a blog section. It renders the file's content followed
by an instance of the [`markee-article-list`](./preconfigured-elements.md#markee-article-list) element, with the
`filter-same` option set to `root` to list all articles of that root save the index file itself.

## `pages`

The `pages` layout can be used to display your content raw without any styles and only the `main` section.

## `404`

Finally, the `404` layout offers a default 404 page stating 'Page not found' and offering the user a link to the
root of the website.
