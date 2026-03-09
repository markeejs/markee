---
plugins:
  tabbedContent:
    linkTabs: false
tags:
  - Markee
  - Advanced
  - Guides
  - Multi Word
---

# Advanced Features

On top of the [basic Markdown syntax](./basic-markdown-syntax.md), Markee also comes with advanced extensions to give
even greater control.

## Advanced Tables

[Tables](./basic-markdown-syntax.md#tables) can be styled at the table, row and cell level using the attributes syntax.
- Adding attributes inside a cell will style this specific cell
- Adding attributes at the end of a row will style the entire row
- Adding attributes at the end of a row after a | will style the entire table

You can combine the row style syntax and table style syntax on the same row.

Unfortunately, to stay compatible with GFM, the header row cannot be styled. You can add a class to your table and use CSS
to style the header if needed.

:::tab[Example]
<!-- ex:style-table:start -->
| Table      | With       | Style                                                 |
|------------|------------| ------------------------------------------------------|
| Red row    | Red row    | Red row                                               |{style="background:pink; color:black;"}
| Italic row | Italic row | Blue cell {style="background:lightblue; color:black"} |{style="font-style: italic"}|{style="border: 0.5rem dotted black; padding: 1rem; border-collapse: initial;"}
<!-- ex:style-table:stop -->
:::
:::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:style-table:start -->"
    end "<!-- ex:style-table:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```

You can also merge cells together: any cell containing only `>` will get merge to the right, and any cell containing
only `^` will get merge to the top.

:::tab[Example]
<!-- ex:merge-table:start -->
| Table                                        | With          | Merge          |
|:--------------------------------------------:|:-------------:|:--------------:|
| Merged rows {style="vertical-align: middle"} | >             | Merged columns |
| ^                                            | Normal column | Normal column  |
<!-- ex:merge-table:stop -->
:::
:::tab[Source]
{%
  include-self
  start "<!-- ex:merge-table:start -->"
  end "<!-- ex:merge-table:stop -->"
  preserve-includer-indent false
  preserve-delimiters false
%}
:::

## Code blocks

### Code highlighting

Code highlighting is available with [Prism](https://prismjs.com/) with [many languages supported](https://prismjs.com/#supported-languages).

Specific lines can be highlighted by passing the line numbers to the `hl_lines` argument placed right after the language shortcode.

:::tab[Example]
<!-- ex:code:start -->
```go hl_lines="11 24-27"
package main

import "fmt"

func main() {
    // This is a single-line comment

    /* This is a
    multi-line comment */

    fmt.Println("Hello, World!")

    // Variable declaration and assignment
    var x int = 5
    y := 10

    // If-else statement
    if x > y {
        fmt.Println("x is greater than y")
    } else {
        fmt.Println("x is less than or equal to y")
    }

    // For loop
    for i := 0; i < 5; i++ {
        fmt.Println(i)
    }

    // Array declaration and initialization
    numbers := [5]int{1, 2, 3, 4, 5}

    // Looping through an array using range
    for index, value := range numbers {
        fmt.Printf("Index: %d, Value: %d\n", index, value)
    }

    // Function declaration
    result := addNumbers(3, 7)
    fmt.Println("Sum:", result)
}

// Function definition
func addNumbers(a, b int) int {
    return a + b
}
```
<!-- ex:code:stop -->
:::
:::tab[Source]
~~~markdown
{%
    include-self
    start "<!-- ex:code:start -->"
    end "<!-- ex:code:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
~~~
:::

### Title and line numbers

You can add a title to your codeblock by adding `title="Your title"` after the language specifier.

You can also toggle-on line numbers by adding `linenums` after the language specifier.

:::tab[Example]
<!-- ex:code-modifiers:start -->
```markdown title="Sample Markdown" linenums
# Sample Codeblock

This codeblock has a title and line numbers.
```
<!-- ex:code-modifiers:stop -->
:::
:::tab[Source]
~~~markdown
{%
  include-self
  start "<!-- ex:code-modifiers:start -->"
  end "<!-- ex:code-modifiers:stop -->"
  preserve-includer-indent false
  preserve-delimiters false
%}
~~~
:::

## Image Lightbox

By default, all images within a markdown file will have lightbox functionality enabled.
This means when you click an image, it will open in a lightbox view.

:::tab[Example]
<!-- ex:lightbox:start -->
![Image description](./images/img-1.webp)
<!-- ex:lightbox:stop -->
:::
:::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:lightbox:start -->"
    end "<!-- ex:lightbox:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
:::

### Disabling Lightbox

If you wish to disable lightbox on your images, there are two options:

#### Disable for one image

To disable lightbox for a specific image, you can add the `.skip-lightbox` class to the image. 
For compatibility reasons, `.off-glb` is also supported.

:::tab[Example]
<!-- ex:lightbox-disabled:start -->
![Image description](./images/img-2.webp){ .skip-lightbox }
![Image 2 description](./images/img-3.webp){ .off-glb }
<!-- ex:lightbox-disabled:stop -->
:::
:::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:lightbox-disabled:start -->"
    end "<!-- ex:lightbox-disabled:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
:::

#### Disabling for a whole file

If you want to disable the lightbox for all images within a file, you can specify it at the top of the file:

:::tab[Example]
<!-- ex:lightbox-force-off:start -->
![Image description](./images/img-4.webp){ .skip-lightbox }
:::
:::tab[Source]
```markdown
---
lightbox: false
---

    {%
        include-self
        start "<!-- ex:lightbox-force-off:start -->"
        end "{ .skip-lightbox }"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```
:::

It is still possible to enable lightbox for a specific image inside a file for which lightbox is globally disabled,
through the `.force-lightbox` class, or `.on-glb` for compatibility.

:::tab[Example]
<!-- ex:lightbox-force-on:start -->
![Image description](./images/img-5.webp){ .force-lightbox }
<!-- ex:lightbox-force-on:stop -->
:::
:::tab[Source]
~~~markdown
---
lightbox: false
---

{%
    include-self
    start "<!-- ex:lightbox-force-on:start -->"
    end "<!-- ex:lightbox-force-on:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
~~~
:::

## Grids and Cards

You can organize your content as grids and optionally wrap blocks into cards by using the `:::content-grid` and `:::card-grid`
blocks.

::::tab[Example]
<!-- ex:grids:start -->
:::content-grid
This paragraph will be in the first grid cell

This paragraph will be in the second grid cell
:::

:::card-grid
This paragraph will be in the first grid cell

This paragraph will be in the second grid cell
:::
<!-- ex:grids:stop -->
::::
::::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:grids:start -->"
    end "<!-- ex:grids:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
::::

In grids, all _blocks_ will end up in their own cell. Because each paragraph is its own block, you need to explicitly wrap
them if you want multiple paragraphs in the same cell. You can use custom blocks to build advanced cards.

:::::tab[Example]
<!-- ex:grids-advanced:start -->
::::card-grid
:::div
Those two paragraphs

Will be in the first cell
:::

This third paragraph will be in the second cell
::::

::::card-grid
:::div
## Card title {style='margin:0'}

Card content
:::

:::div
## Card title {style='margin:0'}

Card content
:::
::::
<!-- ex:grids-advanced:stop -->
:::::
:::::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:grids-advanced:start -->"
    end "<!-- ex:grids-advanced:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
:::::

## Nesting HTML

Markee support deep interoperability between Markdown and HTML. This means you can easily nest HTML code inside
your Markdown, but you can also _nest more markdown_ inside this HTML.

HTML is treated following the [CommonMark specification](https://spec.commonmark.org/0.30/#html-blocks), which
means it cannot contain empty lines. This makes some Markdown nesting impossible.

:::tab[Example]
<!-- ex:html:start -->
<div>
  <!-- HTML comments are supported correctly -->
  <p>This HTML paragraph **can contain markdown**</p>
  <code>This will not be **treated**, since it is `inline code`</code>
  <p>But **this** will</p>
  <div style='color:red;text-decoration:underline;'>
    <p>And **this** too</p>
    <code>But **this**, nope</code>
  </div>
  <p>And finally this one contains **Markdown formatting with nested <i>HTML and ~~nested markdown~~</i>**</p>
  <div>
    ```markdown
    **Nested code blocks work too, as long as they contain no empty line**
    ```
  </div>
  <p>
    **As in Markdown, inline clauses can
    span multiple lines**
  </p>
</div>
<!-- ex:html:stop -->
:::
:::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:html:start -->"
    end "<!-- ex:html:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
:::

### Disabling Markdown parsing

Sometimes you might want to add HTML and expect its content to be left as-is, without being parsed as Markdown. You
can do so by adding the `data-pristine` attribute on your root HTML tag.

:::tab[Example]
<!-- ex:html:pristine:start -->
<p data-pristine>
  <!-- HTML comments are supported correctly -->
  <span>When using data-pristine, inlined Markdown **won't be parsed**</span>
  <br />
  <code>This will not be **treated**, since it is `inline code`</code>
  <br />
  <span>But **this** won't either since we're in a pristine HTML block</span>
  <br />
  <span style='color:red;text-decoration:underline;'>
    HTML styling is still supported of course
  </span>
  <br />
  <span>
    And finally this one contains **Markdown formatting with nested <i>HTML and ~~nested markdown~~</i>**, but only the HTML is applied.
  </span>
  <br />
  <span>
    **Nested HTML still needs to not include empty lines though, as this is still inside a Markdown document**
  </span>
</p>
<!-- ex:html:pristine:stop -->
:::
:::tab[Source]
```markdown
{%
    include-self
    start "<!-- ex:html:pristine:start -->"
    end "<!-- ex:html:pristine:stop -->"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
:::

## Including files

Following similar syntax from [mkdocs-include-markdown-plugin](https://github.com/mondeja/mkdocs-include-markdown-plugin), you can include other files into a document.

:::tab[Example]
{%
  include-markdown "includes/file.md"
  start="<!--intro-start-->"
  end="<!--intro-end-->"
  preserve-includer-indent=true
  rewrite-relative-urls=false
%}
:::
:::tab[Source]
```markdown
{!
    include-markdown "includes/file.md"
    start="<!--intro-start-->"
    end="<!--intro-end-->"
    preserve-includer-indent=true
    rewrite-relative-urls=true
!}
```
:::

Options available when including files are:

- **start**: Delimiter that marks the beginning of the content to include.
- **end**: Delimiter that marks the end of the content to include.
- **preserve-includer-indent** (_true_): When this option is enabled (default), every line of the content to include is indented with the same number of spaces used to indent the includer `{! !}` template. Possible values are `true` and `false`.
- **rewrite-relative-urls** (_true_): When this option is enabled (default), Markdown links and images in the content that are specified by a relative URL are rewritten to work correctly in their new location. Possible values are `true` and `false`.
