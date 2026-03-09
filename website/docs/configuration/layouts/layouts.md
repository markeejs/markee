# Layouts

Markee documents are displayed inside a given _layout_, which can be customized to your needs.

## Layout sections

A Markee layout is composed of seven distinct sections:

::::block[div]{.sections}
::div[Header _#markee-header_]{.header}
::div[Top _#markee-section-top_]{.top}
:::block[div]{.markee-main}
::em[#markee-main]{#test}
::div[Left _#markee-section-left_]{.left}
::div[Main _#markee-section-main_]{.main}
::div[Right _#markee-section-right_]{.right}
:::
::div[Bottom _#markee-section-bottom_]{.bottom}
::div[Footer _#markee-footer_]{.footer}
::::

<style>
.sections {
    display: grid;
    grid-template:  "header" 1fr
                    "top" 1fr
                    "markee" 3fr
                    "bottom" 1fr
                    "footer" 1fr / 1fr;
    width: 100%;
    gap: 0.25rem;
    margin-bottom: 2rem;

    div {
        border: 3px solid rgba(0,0,0,0.1);
        border-radius: 0.5rem;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: bold;
        flex-direction: column;
        text-align: center;
        padding: 0.5rem;
        
        em {
            font-size: 0.7em;
        }
    }

    .markee-main {
      display: grid;
      gap: 0.25rem;
      grid-template: 
            "title title title" auto
            "left main right" 1fr / 1fr 2fr 1fr;
      border: 3px solid rgba(0,0,0,0.1);
      border-radius: 0.5rem;
      padding: 0.25rem;

      > em {
        grid-area: title;
        font-size: 0.7em;
      }

      > div {
        height: 100%;
      }
    }

    .header { grid-area: header; background-color: var(--mk-admonition-background-danger); color: var(--mk-admonition-color-danger); }
    .top { grid-area: top; background-color: var(--mk-admonition-background-warning); color: var(--mk-admonition-color-warning); }
    .left { grid-area: left; background-color: var(--mk-admonition-background-hint); color: var(--mk-admonition-color-hint); }
    .main { grid-area: main; background-color: var(--mk-admonition-background-default); color: var(--mk-admonition-color-default); }
    .right { grid-area: right; background-color: var(--mk-admonition-background-hint); color: var(--mk-admonition-color-hint); }
    .bottom { grid-area: bottom; background-color: var(--mk-admonition-background-warning); color: var(--mk-admonition-color-warning); }
    .footer { grid-area: footer; background-color: var(--mk-admonition-background-danger); color: var(--mk-admonition-color-danger); }
}
</style>

All of those sections are optional except **Main**. By default, the content of your documents are rendered in the **Main**
section.

The **Left**, **Main** and **Right** section are wrapped in a block with the ID `#markee-main` to allow for their
default layout as a row.

### Shared sections

The **Header** and **Footer** sections are shared across all your layouts. This is because most of the time, you want
your header and footer to be consistent across your website.

Of course, you can still personalize those section's styling independently for each layout.

### Specialized sections

All other sections are configured individually for each layout. It's up to you to decide which of your layouts require
any of them, and what they contain.

## Defining layouts

To define a new layout for your website, simply create a new folder in the `_assets/_layouts` directory.
The name of your folder will be the name of your layout. For instance, if you want to create a `docs` layout, simply
create the `_assets/_layouts/docs` folder.

Then, inside that folder, you will be able to create files for each of the section you want to add to that layout.
Omitting a file will mean that this specific section will not get rendered.

When a file is provided for a given section, it will get rendered wrapped in a `div` with the ID `#markee-section-<section>`.

### Writing an HTML section

The first way to define the content of a section is to create an HTML file. Simply name the file `<section>.html`, where
`<section>` is the lower-case name of any specialized section: `top.html`, `left.html`, `main.html`...

You can then define any HTML content you would like to see in that section.

### Writing a Markdown section

Alternatively, you can write the content of your section in Markdown format. Simply name your file `<section>.md` in this
case. Your section will go through the standard Markdown-to-HTML pipeline, so any Markee syntax is available in them.

### Extending a section from an extension

Sometimes, you might want to reuse a section from a Markee extension you've installed. By default, if you install a Markee
extensions, all layouts defined in that extension are available in your website. However, if you create your own layout
with the same name as one defined in an extension, your layout will override the one from the extension.

You can restore each section of that extension's layout by creating a file named `<section>.yaml`, with the following content:

```yaml
extends: '@my-company/markee-preset' # Put the name of your extension here.
```

Alternatively, if you want to keep all sections from an extension except the ones you override explicitly, you can leverage
the `default.yaml` file in your layout. It acts like `<section>.yaml` but is used in place of all sections that are not
explicitly defined.

For instance, if you have the following files in an extension:

```
@my-company/markee-preset/_assets/layouts/docs
  left.md
  main.md
  right.md
```

And the following ones locally:

```
_assets/layouts/docs
  default.yaml
  main.md
```

If `default.yaml` contains `extends: '@my-company/markee-preset'`, then `left.md` and `right.md` will be loaded from
the extension, while `main.md` will use the local one.

Without `default.yaml`, only the local `main.md` would be loaded and the `left` and `right` sections would be empty.

### Reusing another layout or another section

Using the YAML format for a section, you can also point to another layout, or another section, or both. You can even
combine this with the extension system:

```yaml
# Use the same section from a different layout:
layout: other-layout

---
# Use a different section from the same layout:
section: left

---
# Use a different section from a different layout:
layout: other-layout
section: right

---
# Use a specific section from a specific layout in an extension:
extends: '@markee/defaults'
layout: docs
section: left
```

`section` can only be one of `top | left | main | right | bottom`, it cannot be `header` or `footer`.

## Defining shared sections

To define shared sections (**Header** and **Footer**), you need to create files in the `_assets` directory
named `_<section>.(html|md|yaml)`. For instance, to add a header to your website, simply create the `_assets/_header.html`
file.

As for specialized sections, you can use either an HTML file, a Markdown file, or a YAML file.

If you use a YAML file, only `extends` and `section` are available.

`section` can only be `header` or `footer`, it cannot be one of the specialized sections.

## Using your layouts

You can define which layout to use for your files in several ways.

The most common way is to assign a layout to your sources directly:

```yaml title=markee.yaml
sources:
    - root: docs
      layout: docs
    - root: blog
      layout: blog
```

:::info[Default layouts]{collapsed}
Some default layouts are available with Markee and inferred from your source root:

- If your source root is `docs`, the default layout will be `docs`
- If your source root is `blog`, the default layout will be `blog`
- If your source root is `pages`, the default layout will be `pages`
- For any other source root, the default layout will be `docs`
:::

But you can also override the layout used by a file in its front-matter:

```yaml title=blog/index.md
---
layout: blog-list
---
```

And optionally, you can change the layout of all the files in a folder by specifying
a layout through the `meta` field of its `.section` file:

```yaml title=docs/release-notes/.section
meta:
  layout: release-notes
```

## Rendering your content

As stated earlier, the default behavior of the **Main** section is to render the document's content. However, if you
provide your own **Main** section for a layout, this behavior will be lost.

You can get it back by rendering the `<markee-content></markee-content>` custom element anywhere in your layout.
If you're using the Markdown syntax, you can use the shorthand `::markee-content`.


## Styling your layouts

As described above, each section has its own ID, which you can use to target CSS styles for its content.

If you need to scope some styles to a specific layout, you can also use a styling hook attached to the `body`
element: each time a document is rendered, a `data-layout` attribute is added to the `body` element.

Therefore, you can easily scope your styles:

* to a specific layout:
    ```css 
    body[data-layout="my-layout"] {  ...  }
    ```
    ::br

* to a specific section:
    ```css
    #markee-section-left {  ...  }
    ```
    ::br

* to a specific section in a given layout:
    ```css
    body[data-layout="my-layout"] #markee-section-left {  ...  }
    ```

## Special case: 404

When a page is opened and does not correspond to any file, the layout cannot be read from the file's metadata. In this
case, it will automatically default to `404`. You can use this to customize your 404 page like you would customize any
layout.
