---
plugins:
  tabbedContent:
    linkTabs: false
---

# Custom Blocks

You can add structure and style to your documents with custom classes, attributes, and elements.

## Custom attributes

Add classes, identifiers, and attributes to your Markdown with `{.class #identifier attr=value attr2="spaced value"}` curly brackets, similar to [pandoc's header attributes](http://pandoc.org/README.html#extension-header_attributes).

=== Example

    <!-- ex:custom-attr:start -->
    # Pink Header {style="color: deeppink; margin: 1rem 0 1rem"}
    <!-- ex:custom-attr:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:custom-attr:start -->"
        end "<!-- ex:custom-attr:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

### Adding attributes to inline text

By default, attributes can only be added to Markdown entities: paragraphs, blockquotes, fences, bold or italics... If you want to add
attributes to a single word in a sentence for instance, you can create an inline-block by wrapping the words you want
to customize in `[ ]`.

=== Example

    <!-- ex:inline-attr:start -->
    This is a couple of [teal words]{style="color: teal"} in the middle of the sentence.
    <!-- ex:inline-attr:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:inline-attr:start -->"
        end "<!-- ex:inline-attr:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

### Wrapping multiple blocks in a single custom block

Sometimes you want to add some attributes to a group of blocks rather than a single one.

Markee supports the [CommonMark Directives proposed syntax](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444),
pre-configured to handle HTML elements.

You can use this to wrap multiple blocks in a single `div`, or any other HTML element that fits your needs.

The directive syntax supports the same attributes syntax as the single-block example above.

::::tab[Example]{#directive-syntax}
:::div{style="color: orange; font-weight: bold"}
The following paragraphs will inherit the style of the wrapping block.

They will all be orange and bold, without having to specify it for every block.
:::
::::

::::tab[Source]
```markdown
{%
    include-self
    start "::::tab[Example]{#directive-syntax}"
    end "::::"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
::::

The directives syntax is configured so that any valid HTML tag name is turned into the corresponding HTML element,
and any directive name containing a dash is treated as an HTML [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).

Other directive names will be used as [call-outs](#adding-call-outs-or-warning-boxes).

## Adding call-outs or warning boxes

Call-outs, also known as admonitions, are an excellent choice for including side content without significantly interrupting the document flow.

::::tab[Example]{#call-outs}
:::note
Lorem ipsum
:::
::::
::::tab[Source]
```markdown
{%
    include-self
    start "::::tab[Example]{#call-outs}"
    end "::::"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
::::
::::tab[Types]
:::summary
Lorem ipsum
:::

:::abstract
Lorem ipsum
:::

:::tldr
Lorem ipsum
:::

:::info
Lorem ipsum
:::

:::todo
Lorem ipsum
:::

:::tip
Lorem ipsum
:::

:::hint
Lorem ipsum
:::

:::success
Lorem ipsum
:::

:::check
Lorem ipsum
:::

:::done
Lorem ipsum
:::

:::question
Lorem ipsum
:::

:::help
Lorem ipsum
:::

:::faq
Lorem ipsum
:::

:::warning
Lorem ipsum
:::

:::attention
Lorem ipsum
:::

:::caution
Lorem ipsum
:::

:::failure
Lorem ipsum
:::

:::fail
Lorem ipsum
:::

:::missing
Lorem ipsum
:::

:::danger
Here will be dragons
:::

:::error
Lorem ipsum
:::

:::bug
Lorem ipsum
:::

:::example
Lorem ipsum
:::

:::snippet
Lorem ipsum
:::

:::quote
Lorem ipsum
:::

:::cite
Lorem ipsum
:::

:::unknown
Lorem ipsum
:::
::::

### Collapsible call-outs

You can add the `collapsed` flag to your call-out to make it collapsible. Either use `collapsed` to start the call-out as collapsed,
or `collapsed=false` to start it expanded but collapsible.

::::tab[Example]{#collapsible-admonition}
:::unknown[Collapsible Admonition]{collapsed}
This content is hidden by default
:::

:::unknown[Collapsible Open]{collapsed=false}
This content is shown by default
:::
::::
::::tab[Source]
```markdown
{%
    include-self
    start "tab[Example]{#collapsible-admonition}"
    end "::::"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
::::

## Creating tabbed content

Similar to [PyMdown Tabbed extension](https://facelessuser.github.io/pymdown-extensions/extensions/tabbed/), you can create tabs in your documents (similarly to the examples we showcase in this document).

For this, simply use the `tab` directive:

::::tab[Example]{#tabs}
:::tab[Tab 1]
Markdown **content**.

Multiple paragraphs.
:::
:::tab[Tab 2]
More Markdown **content**.

- list item a
- list item b
:::
::::
::::tab[Source]
```markdown
{%
    include-self
    start "::::tab[Example]{#tabs}"
    end "::::"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
::::

### Linked tabs

By default, the tabs are linked if they have the same title on the page.
You can disable this behavior by adding a configuration variable `plugins.tabbedContent.linkTabs` to `false`.

Regardless of the configuration for the current file, you can specify the linking behavior for a specific
tab through the `linked` and `unlinked` flag attributes. `linked` will link tabs when the default behavior
is `false`, while `unlinked` will disable linking when the default behavior is `true`.

::::tab[Example]{#tabs-links}
:::tab[Tab 1]{linked}
Linked tab 1
:::
:::tab[Tab 2]{linked}
Linked tab 2
:::

---

:::tab[Tab 1]{linked}
Linked tab 1
:::
:::tab[Tab 2]{linked}
Linked tab 2
:::

---

:::tab[Tab 1]{unlinked}
Unlinked tab 1
:::
:::tab[Tab 2]{unlinked}
Unlinked tab 2
:::
::::
::::tab[Source]
```markdown
{%
    include-self
    start "tab[Example]{#tabs-links}"
    end "::::"
    preserve-includer-indent false
    preserve-delimiters false
%}
```
::::
