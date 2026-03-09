---
plugins:
  tabbedContent:
    linkTabs: false
---

# Basic Markdown Syntax

Markee uses Markdown as its authoring language. It follows the [CommonMark spec](http://spec.commonmark.org/),
with some additional features added on top, inspired by other Markdown-based documentation generators.

## Tables

Tables from the [GFM](https://help.github.com/articles/organizing-information-with-tables/) are supported.

=== Example
    
    <!-- ex:table:start -->
    | First Header  | Second Header  |
    | ------------- |:--------------:|
    | Content Cell  | Centered Cell  |
    | Content Cell  | Centered Cell  |
    <!-- ex:table:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:table:start -->"
        end "<!-- ex:table:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

## Strikethrough, Insertion and Marks

Strikethrough text style from the [GFM](https://help.github.com/articles/basic-writing-and-formatting-syntax/#styling-text) is supported.

You can also use Insertion syntax, and Mark syntax.

=== Example

    <!-- ex:strike:start -->
    ~~This was mistaken text~~

    ++This is the corrected text++

    ==This text is highlighted==
    <!-- ex:strike:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:strike:start -->"
        end "<!-- ex:strike:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

## Footnote

Markup is based on [pandoc](https://pandoc.org/demo/example33/8.19-footnotes.html) definition.

=== Example

    <!-- ex:footnote:start -->
    Here is a footnote reference[^1], and another.[^longnote]

    [^1]: Here is the footnote.
    
    [^longnote]: Here's one with multiple blocks.

         Subsequent paragraphs are indented to show that they
         belong to the previous footnote.
    <!-- ex:footnote:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:footnote:start -->"
        end "<!-- ex:footnote:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

## Anchors

For each heading, an `id` attribute is added with slugified title to allow anchors

=== Example
    
    <!-- ex:anchor:start -->
    [Link to the #anchors in this page](#anchors)
    <!-- ex:anchor:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:anchor:start -->"
        end "<!-- ex:anchor:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

## Abbreviations

Markup is based on [php markdown extra](https://michelf.ca/projects/php-markdown/extra/#abbr).

=== Example

    <!-- ex:abbr:start -->
    *[HTML]: Hyper Text Markup Language
    *[W3C]:  World Wide Web Consortium

    The HTML specification is maintained by the W3C.
    <!-- ex:abbr:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:abbr:start -->"
        end "<!-- ex:abbr:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```
