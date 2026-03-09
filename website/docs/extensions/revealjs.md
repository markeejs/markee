# RevealJS

The `@markee/revealjs` extension allows using [Reveal.JS](https://revealjs.com/) in your Markee documents.

## Usage

You can use the custom blocks `::::reveal-js` and `:::reveal-slide` to add slides.

### Options

- **`data-config: string`**: JSON string merged into RevealJS initialization options.
- **`data-layout: string`**: set to `raw` to disable RevealJS layout transforms (`disableLayout: true`).

```markdown
::::reveal-js{data-config='{"transition":"fade","controls":false}'}
:::reveal-slide
Slide with custom RevealJS config
:::
::::
```

=== Example
    <!-- start -->
    ::::reveal-js{style="height:36rem"}
    :::reveal-slide
    First page
    :::
    
    :::reveal-slide
    Second page
    :::
    ::::
    <!-- stop -->

=== Source

    ```markdown
    {%
        include-self
        start "<!-- start -->"
        end "<!-- stop -->"
        preserve-includer-indent false
        preserve-delimiters false
    %}
    ```

### Raw layout mode

If you need full control over sizing and positioning, use `data-layout=raw`:

```markdown
::::reveal-js{data-layout=raw style="height:36rem"}
:::reveal-slide
Raw layout mode
:::
::::
```
