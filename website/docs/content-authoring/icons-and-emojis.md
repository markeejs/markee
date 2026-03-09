---
plugins:
  tabbedContent:
    linkTabs: false
---

# Icons and Emojis

You can use icons and emojis in any of your documents.

## Material icons

[Material Design Icons](https://pictogrammers.com/library/mdi/) are supported.

=== Example
    :material-cloud-check-variant-outline:

=== Source
    ```markdown
    :material-cloud-check-variant-outline:
    ```

## FontAwesome icons

[Font Awesome Icons](https://fontawesome.com/icons) are also supported.

=== Example
    :fontawesome-burger:

=== Source
    ```markdown
    :fontawesome-burger:
    ```


## Simple icons

[Simple Icons](https://github.com/simple-icons/simple-icons) are useful when you need a brand icon.

=== Example
    :simple-gitlab:
    :simple-github:

=== Source
    ```markdown
    :simple-gitlab:
    :simple-github:
    ```

## Emoji

Add emoji syntax support with shortcuts. You can still add any emoji from [Unicode](https://unicode.org/) 🔥.

=== Example
    Hello from Mars :satellite:

=== Source
    ```markdown
    Hello from Mars :satellite:
    ```

## Flags

Flag emojis are supported through [Github syntax](https://github.com/ikatyang/emoji-cheat-sheet#country-flag).

You can also alternatively prefix any valid Github syntax with `flag_` and it will still work.

=== Example
    Github syntax: :us: :fr: :canada:

    Flag syntax: :flag_us: :flag_fr: :flag_canada:

=== Source
    ```markdown
    Github syntax: :us: :fr: :canada:

    Flag syntax: :flag_us: :flag_fr: :flag_canada:
    ```

## Styling

Icons can also be styled:

=== Example

    <!-- ex:style-icon:start -->
    Made with :fontawesome-heart:{style="color:red"} by the Markee team!
    <!-- ex:style-icon:stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- ex:style-icon:start -->"
        end "<!-- ex:style-icon:stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```
