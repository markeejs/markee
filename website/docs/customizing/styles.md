# Custom CSS

Styling in Markee is done using standard CSS.

You can add custom styles to your Markee website by placing `.css` files inside the `_assets/_head` folder.
Files are added in alphabetical order, and files higher in the filesystem tree are inserted first.

## Styling hooks

Markee provides several styling hooks on the `body` element that you can rely on for your custom styles.

### `data-theme`

Any value you set in the `theme` field of your [config file](../configuration/config-file.md#theme) will be synced
to `data-theme` on your `body` element. This lets you scope your CSS below a `[data-theme=my-theme]` selector. This
is mostly useful when creating shareable themes.

### `data-color-scheme`

Will be set to `light` or `dark`, depending on the currently selected color scheme. The color scheme is read for the
user's system preferences initially, and can be optionally overridden through the [`$colorScheme`](./scripts/shared-state.md#colorscheme)
state variable, or controlled through the [`markee-color-scheme-manager` custom element](../configuration/layouts/preconfigured-elements.md#markee-color-scheme-manager).

### `data-loading`

Whenever a file is requested and is currently loading, the `data-loading="true"` attribute will be added to the `body` element.
When the current file is ready, `data-loading="false"` will be added instead.

### `data-path`

The current path from the URL is added to the `body` as `data-path` to let you style things based on the active page.

### `data-layout`

The name of the layout currently used by the loaded file is synced to the `body`, letting you scope styles to specific layouts
easily.

### `class`

You can add custom CSS classes to the `body` element by providing a `class` entry in a document's front-matter. This lets
you target specific files, even within the same layout.

## CSS Variables

Markee base styles rely on a few CSS variables which you can configure at will.

Here are those variables and their default value:

| Variable                       | Default value | Usage                                                                                                                    |
|--------------------------------|---------------|--------------------------------------------------------------------------------------------------------------------------|
| `--mk-color-text`              | `#000000`     | Color of the default body text in your document. Most texts use this.                                                    |
| `--mk-color-hint`              | `#868E96`     | Color used for dimmed text in area such as footnotes.                                                                    |
| `--mk-color-primary`           | `#1C7ED6`     | Primary accent color, used in buttons and links.                                                                         |
| `--mk-color-primary-darker`    | `#1864AB`     | Darker shade of the primary accent color, used for hover effects.                                                        |
| `--mk-color-background`        | `#F8F9FA`     | Main background color of the page.                                                                                       |
| `--mk-color-background-light`  | `#FFFFFF`     | Lighter background color used for the main content section.                                                              |
| `--mk-color-background-code`   | `#F8F9FA`     | Background color used for code blocks.                                                                                   |
| `--mk-color-background-mark`   | `#228BE6`     | Background color used on `mark` elements in search-boxes and filters.                                                    |
| `--mk-color-background-target` | `#228BE6`     | Background color used by `:target` elements in footnotes                                                                 |
| `--mk-color-border`            | `#E9ECEF`     | Default border color used between sections                                                                               |
| `--mk-color-border-blockquote` | `#CED4DA`     | Border color used to delimit a blockquote.                                                                               |
| `--mk-max-width`               | `100rem`      | Maximum width of the main content section, used if `default` theme.                                                      |
| `--mk-header-height`           | `0`           | Height of your header fragment. Used for anchor scroll margin <br/> to avoid anchors being hidden below a sticky header. |
| `--mk-footer-height`           | `0`           | Height of your footer fragment. Not technically used as of now.                                                          |

To change one of those variables, you can define your own variable on `:root`, replacing the `mk-`
prefix with `markee-`. The `mk-` variable will then use your value rather than its default value.

```css
:root {
    --markee-color-primary: #C12C18;
}

/* --mk-color-primary will use #C12C18 instead of its default value */
```

## Style layers

To ease overriding styles, Markee leverages [CSS layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer).

Two layers are created by default with a specific order: 
- `markee`, used by the base styles provided by Markee for it to work properly; 
- and `markee-extension`, used by default extensions provided by Markee to easily override styles from 
  the `markee` layer without taking priority over your own styles.

We recommend wrapping your own styles in layers whenever you intend to share them across multiple websites.

## Hot-reload

In development mode, your style files will be automatically swapped when they are updated, allowing you to 
see your changes live in the browser. 
