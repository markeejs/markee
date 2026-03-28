# Config File

The Markee config file controls how your site is built and served.
This page documents all available options for both CLI behavior and the client runtime.

## File name and format

The Markee configuration file uses YAML.
The CLI looks for the following files in order and stops at the first match:

- `markee.yaml`
- `markee.yml`
- `.markeerc`

The file should be at the root of your Markee project.

## CLI-side configuration

Some options are CLI-only and are not shared with the client.

### `sources`

The `sources` option is explained in detail in the [getting started section](../getting-started/sources.md).

It defines where your Markdown source files are located and how they should be served.

It is an array of source objects, each with `root`, `mount`, and `layout` fields.

#### `root`
{#source-root}

{%
    include "../getting-started/sources.md"
    start "<!-- sources-root-start -->"
    end "<!-- sources-root-end -->"
    preserve-delimiters false
%}

#### `mount`
{#source-mount}

{%
    include "../getting-started/sources.md"
    start "<!-- sources-mount-start -->"
    end "<!-- sources-mount-end -->"
    preserve-delimiters false
%}

#### `layout`
{#source-layout}

{%
    include "../getting-started/sources.md"
    start "<!-- sources-layout-start -->"
    end "<!-- sources-layout-end -->"
    preserve-delimiters false
%}

### `server`

The `server` option allows you to configure how the server behaves in
`dev` and `serve` mode. It lets you modify the host, port or both:

```yaml
server:
  host: localhost
  port: 3000
```

The host and port can also be specified as flags in the command line.
Values of the flags will override values configured in the config file.

### `build`

The `build` option gives you control over various outputs of the
`build` step. The `build.outDir` option is also used by the `serve`
command to determine which directory to serve from.

There are seven sub-fields to this option:

#### `outDir`

`outDir` controls the directory inside which the built website will be 
generated. When omitted, it will default to `site`.

The out directory can also be specified as a flag in the command line.
In that case, it will override any value configured in the config file.

#### `skipLinkValidation`

Controls how `markee build` behaves when broken links are detected.

- `false` (default): build fails when broken links are found.
- `true`: broken links are reported, but the build continues.

```yaml
build:
  skipLinkValidation: true
```

#### `minify`

`minify` enables an optional CSS and JS minification pass during `markee build`.
It applies only to build output, never to `dev`.

- `false` (default): do not minify copied or inlined CSS/JS.
- `true`: minify both CSS and JS.
- object form: enable minification per asset type.

```yaml
build:
  minify: true
```

```yaml
build:
  minify:
    css: true
    js: true
```

This minifies JS and CSS files found in `_assets/`, including inside extensions.

Markee uses a failure-safe strategy here: if a specific file cannot be minified,
the build keeps the original content and logs a warning instead of failing.

Files with a `.min.*` extension are never minified. You can use this to opt out of
minification for specific files.

#### `inlineHeadAssets`

`inlineHeadAssets` controls whether small CSS and JS files found in `_assets/_head`
are inlined directly into the generated `index.html` during `markee build`.

- `false` (default): keep `_assets/_head` files external
- `true`: inline small `_assets/_head` CSS and JS files when they are below Markee's built-in size limits (`4 KB` for JS, `16 KB` for CSS)
- object form: inline `_assets/_head` CSS and JS files using custom thresholds in KB; omitted fields fall back to the built-in defaults

```yaml
build:
  inlineHeadAssets: true
```

```yaml
build:
  inlineHeadAssets:
    js: 8
    css: 24
```

This is a CLI build-time optimization only. It does not affect `dev` mode, where
Markee keeps head assets external for hot reloading.

:::note
Any CSS or JS file containing an `import` keyword will not be inlined, in order to
avoid breaking import mechanisms.
:::

#### `rss`

`rss` lets you configure your build step to emit RSS feeds for some of your articles.
The `rss` field is a map where keys are feed names and values are feed configurations.

An RSS configuration has two subfields: `filter` to define which articles should be
part of the feed, and `settings` to configure the feed itself.

For instance, let's imagine you have a source serving a blog from the `blog/` folder.

You can configure an RSS feed for your blog content with the following configuration:

```yaml
build:
  rss:
    blog:
      filter:
        folder: blog/
      settings:
        site: https://my-website.com
        title: My Blog
```

With this setting, building your website will output a `rss/blog.xml` file in your
out directory, containing an RSS feed of your blog articles.

You can specify as many RSS feeds as you like. Your RSS feeds will also be added
as metadata in the `index.html` of your site to make them discoverable by RSS readers.

Here are all the options you can use when creating an RSS feed:

```yaml
build:
  rss:
    <name>:       # Name of your feed, 
                  # will be used in the output file 
                  # as rss/<name>.xml
      filter:
        folder?: string             # Folder in which to take articles 
                                    # for the feed
        
        author?: string | string[]  # Will limit the feed to articles written
                                    # by one of those authors
        
        tag?: string | string[]     # Will limit the feed to articles with
                                    # one of those tags
      settings:
        site: string                # The root URL of the website where your
                                    # articles are added. Will be used internally
                                    # to add canonical URLs to article entries
        
        title: string               # Title of your feed, used in readers to
                                    # identify your feed
        
        description?: string        # Optional description used in readers as well
        
        size?: number               # Number of articles to keep in your feed. Articles
                                    # are ordered by decreasing date, and only the first
                                    # N articles are kept. Defaults to 10
        
        language?: string           # Language of your content. Defaults to 'en'
        managingEditor?: string     # Name or Email of the person in charge of your feed
        webMaster?: string          # Name or Email of the person in charge of your website
```

#### `sitemap`

`sitemap` lets you configure your build step to output a `sitemap.xml` as well as a corresponding `robots.txt`
file for indexing purposes. You need to pass it the root URL of your hosted website:

```yaml
build:
  sitemap:
    site: string  # The root URL of the website where your
                  # pages are hosted. Will be used internally
                  # to add canonical URLs to sitemap entries
```

#### `splits`

`splits` allows you to configure split builds. Split builds is a way
to host parts of your website on separate hosts.

You start by defining your splits as a map of `name` to `root folder` values:

```yaml
build:
  splits:
    first-split: docs/getting-started
    second-split: docs/content-authoring
```

With this configuration, any content which would normally have ended
in `{outDir}/docs/getting-started` will be moved to `{outDir}/_splits/first-split/docs/getting-started`.

Similarly, anything that would have been in `{outDir}/docs/content-authoring` will end up in `{outDir}/_splits/second-split/docs/content-authoring`.

It is up to you to take the content of `{outDir}/_splits` and upload them
in a way that makes sense in your use case.

Whenever splits are configured, any Markdown file in one of the splits will
receive a `root` parameter telling the client-side router where
to fetch the source file from. By default, it corresponds to the location
of the split in the out directory.

In our example, files inside `docs/getting-started` will receive
a `root` parameter of `/_splits/first-split`. This allows you to deploy
or preview the complete website as if no splits were used.

But you can also configure the root for each split through environment variables.
If you provide an environment variable composed of the `MARKEE_SPLIT_` prefix followed
by the capitalized name of your split with all special characters
replaced with `_`, its value will be used as this split's root.

```bash
export MARKEE_SPLIT_FIRST_SPLIT=http://localhost:3001
export MARKEE_SPLIT_SECOND_SPLIT=http://localhost:3002
markee build
```

With this setup, the root for files in the `docs/getting-started` folder will receive
a `root` parameter of `http://localhost:3001`, and files in the `docs/content-authoring`
folder will receive a `root` parameter of `http://localhost:3002`.

### `watch`

By default, Markee watches all file changes in your working directory. If you want to add more folders to watch,
for instance if you are developing an extension using a monorepo with a playground website, you can add any
folder path relative to your working directory in `watch`:

```yaml
watch:
  - ../extension  # Will watch files in the 'extension' folder sibling to your working directory
```

### `extensions`

Markee can be extended by adding files and/or folders with specific names in the
`_assets` root folder. But it is also possible to share such extensions as NPM packages
for reuse across multiple websites.

To use an extension published as a package, simply add the package as a dependency in
your `package.json`, then add its name in the `extensions` array in your `markee.yaml`

```yaml
extensions:
  - '@my-company/markee-preset'
```

## Shared configuration

The rest of the options can influence both the CLI behavior and the client's.

### `title`

The `title` option lets you configure the title of your website. If omitted, it
will default to `Markee`. The title is used to build the displayed title on
a browser tab. By default, tab titles follow `{site}{if:page: - }{page}`.

### `titleTemplate`

The `titleTemplate` option lets you configure the template used to build the displayed title on
a browser tab. You can use the following placeholders:

- `{site}`: will get replaced with the value of the `title` option.
- `{page}`: will get replaced with the title of the current page.
- `{if:page:<something>}`: will print `<something>` only if the current page has a non-empty title.

When omitted, the default template will be `{site}{if:page: - }{page}`.

If you want to use `|` as a separator between the page title and the site title for instance, you would
use `{page}{if:page: | }{site}`

### `theme`

The `theme` option lets you define a theme name for your Markee website. 
You can set it to any other string value to provide a [custom styling hook](../customizing/styles.md#data-theme).

### `repository`

Link to the repository containing the source code of your website. This is used by
the [`markee-contribute` custom element](../configuration/layouts/preconfigured-elements.md#markee-contribute).

When omitted, `markee-contribute` will not be rendered.

### `repositoryRoot`

Optional path suffix appended to `repository` when generating contribution links.
This is useful when your docs live in a subfolder of the repository.

```yaml
repository: https://github.com/my-org/my-repo
repositoryRoot: /tree/main/docs/
```

When omitted, it defaults to `/`.

### `plugins`

The `plugins` entry is used to configure certain aspects of the Markdown-to-HTML transformation
pipeline. Most options from `plugins` can also be configured on a per-file basis by
adding a `plugins` entry in a file's front-matter.

#### `fileInclude`

:::warning[CLI only]
This option cannot be set on a per-file basis.
:::

Controls how the [file inclusion system](../content-authoring/advanced-features.md#including-files) works.
Here are the available options:

```yaml
plugins:
  fileInclude:
    includeCharacter: '%'  # Character used as the delimiter for file inclusion tags. 
                           # Defaults to '!', meaning inclusion tags will be {! and !}. 
```

#### `tabbedContent`

Controls how [tabbed content](../content-authoring/custom-blocks.md#creating-tabbed-content) behaves.
Here are the available options:

```yaml
plugins:
  tabbedContent:
    linkTabs: false  # Whether tabs of the same name should be linked by default.
                     # Defaults to true
```

#### `lightbox`

Controls how [lightbox](../content-authoring/advanced-features.md#image-lightbox) behaves.
Here are the available options:

```yaml
plugins:
  lightbox:
    enabled: false  # Whether to use lightbox on images and diagrams.
                    # Defaults to true

---
# Alternatively, you can pass a boolean directly to lightbox:
plugins:
  lightbox: false
```

#### `prism`

Controls how [prism](../content-authoring/advanced-features.md#code-blocks) works.
Here are the available options:

```yaml
plugins:
  prism:
    aliases:                # Allows defining aliases for languages. Useful when
      some-alias: yaml      # you use a language not directly supported by Prism
      other-alias: json     # but for which an equivalent syntax exist in Prism
      terraform: hcl        # For instance: terraform, which uses hcl under the hood
      js: javascript        # Or when you want to define shorthands for languages.
                            # Markee ships with some default aliases, but this lets
                            # you add your own.
```

#### `math`

Controls how [mathjax](../content-authoring/advanced-features.md#displaying-math-formulas) works.
This section applies when you use the [`@markee/mathjax`](../extensions/mathjax.md) extension.
Here are the available options:

```yaml
plugins:
  math:
    singleDollar: true  # Whether to support single-dollar markers around formula.
                        # Defaults to `false`, so only double-dollar markers and more
                        # will trigger math formula display.
```

#### Custom fields

You are free to add any custom field to your configuration file. They will be
synced to the client, and available inside the `state.$config`
stateful atom. For instance, you could use this to provide the Git URL of your
website to build an "Edit file" extension:

```yaml
variables:
  gitUrl: https://my-git-repository.com/
```

### `autoAppend`

The `autoAppend` option lets you provide a list of files which should automatically
be appended to all documents before they are transformed from Markdown to HTML.

This is useful for instance to inject abbreviations or links definitions in all your files.

### `redirects`

The `redirects` option lets you provide a map of origin path to destination path for automatic redirect.
Every time a user opens a path listed in your `redirects` map, the router will automatically redirect to
the destination path, without adding a new entry in the browser history.
