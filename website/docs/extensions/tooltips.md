# Tooltips

This extension renders tooltips from `title` attributes.
Once installed, it works automatically on every element with a `title` attribute, including abbreviations.

:::tab[Example]
[This link has a title](# "My title")

[This paragraph has a title]{title="Title on paragraph"}

The HTML specification is maintained by the W3C.

*[HTML]: Hyper Text Markup Language
*[W3C]: World Wide Web Consortium
:::
:::tab[Source]
```md
[This link has a title](# "My title")

[This paragraph has a title]{title="Title on paragraph"}

The HTML specification is maintained by the W3C.

*[HTML]: Hyper Text Markup Language
*[W3C]: World Wide Web Consortium
```
:::

## Footnotes tooltips

This extension can also add tooltips for footnote references.
Set `plugins.tooltips.footnotes` to `true` in your configuration.

:::tab[Example]
Here is a footnote reference[^1], and another.[^2]

[^1]: Here is the footnote.

[^2]: Here's one with multiple blocks.

     It can also have **styling** or [links](#).
:::
:::tab[Source]
```md
Here is a footnote reference[^1], and another.[^2]

[^1]: Here is the footnote.

[^2]: Here's one with multiple blocks.

     It can also have **styling** or [links](#).
```
:::
