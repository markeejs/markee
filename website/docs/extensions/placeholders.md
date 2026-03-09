---
plugins:
    tabbedContent:
        
---

# Placeholders

The `@markee/placeholders` extension allows the use of placeholders to let visitors replace some variables
live inside your page content.

## Usage

### In text content

With the extension imported, simply use the `` `Default value`{placeholder} ``  syntax.

In this paragraph, `this`{placeholder} is a placeholder.

In this one, we use `this`{placeholder} again.

In this one, we use `this`{variable} as a readonly variable with the `` `Default value`{variable} `` syntax.

:::tab[Modifiers]
`{placeholder}` and `{variable}` are treated as modifiers. So, they can be added to any block, not only
snippets. You can add them to **bold**{variable} and _italic_{variable}, or even [custom blocks]{variable}.

It is recommended to use code snippets most of the time as it ensures all characters from the variable are
automatically escaped.
:::
:::tab[Source]
~~~md
`{placeholder}` and `{variable}` are treated as modifiers.
As such, they can be added to any block, not only
snippets. You can add them to **bold**{variable} 
and _italic_{variable}, or even [custom blocks]{variable}.
~~~
:::

### In codeblocks

Inside codeblocks, you will need to use the `[this]{variable}` syntax with brackets instead of backticks.

You'll also need to add a `placeholders` modifier to your block. You can do so for full codeblocks as well as
for inline code snippets.

This one uses `` `[this]{variable}`{placeholders} `` to support placeholders in `[this]{variable} inline code snippet`{placeholders}.

:::tab[Example]
```bash placeholders
echo "This message uses [this]{placeholder} again"
echo "This message uses [this]{variable} again"
echo "This message uses [[this]{placeholder},[this]{variable}] twice in an array"
```
:::
:::tab[Source]
~~~md
```bash placeholders
echo "This message uses [this]{placeholder} again"
echo "This message uses [this]{variable} again"
echo "This message uses [[this]{placeholder},[this]{variable}] twice in an array"
```
~~~
:::

Standard codeblocks and snippets will not replace placeholders:

```bash
echo "This message uses [this]{placeholder} again"
```

### Variable input list

You can also use the `::markee-placeholder-inputs` to create a table automatically field with all the placeholders
from the current page, along with inputs to control their values.

::markee-placeholder-inputs

## Cross-page and persistent variables

By default, variables will reset on page change. If you want your variables to persist, you need to _scope_ theme.
Scoping a variable is done by appending `{scope}` next to the `placeholder` or `variable` modifier:

:::tab[Example]
This paragraph uses a standard variable: [this]{placeholder}. It will not be persisted on page change.

This one uses a scoped variable: [scoped]{placeholder page}. It will be persisted on page change.

```bash placeholders
echo "[scoped]{variable page} variables work in codeblocks too."
```
:::
:::tab[Source]
~~~md
This paragraph uses a standard variable: `this`{placeholder}. It will not be persisted on page change.

This one uses a scoped variable: `scoped`{placeholder page}. It will be persisted on page change.

```bash placeholders
echo "[scoped]{variable page} variables work in codeblocks too."
```
~~~
:::

On shared repositories with multiple teams, try using a scope dedicated to your team to reduce clash risks between pages.

## Styling

You can update the color of the text and the background color through CSS variables:

```css
/* In your root style-guide: */
:root {
    --markee-color-placeholders: #C12C18FF;
    --markee-color-background-placeholders: #C12C1822;
}

/* On a nested section selector: */
.styled-placeholders {
    --mk-color-placeholders: #C12C18FF;
    --mk-color-background-placeholders: #C12C1822;
}
```

<br>

> This uses styled placeholders on the `styled`{placeholder} keyword.
{.styled-placeholders}

<style>
.styled-placeholders {
    --mk-color-placeholders: #C12C18FF;
    --mk-color-background-placeholders: #C12C1822;
}
</style>
