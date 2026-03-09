---
plugins:
  tabbedContent:
    linkTabs: false
---

# MathJax

The `@markee/mathjax` extension enables LaTeX-style math rendering with MathJax.

## Usage

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/mathjax'
```

Then write formulas with standard fenced math markers:

:::tab[Example]
$$ Service Availability = \frac{1 - 60}{28 * 24 * 60}*100 = 99.85\% $$
:::
:::tab[Source]
```markdown
$$ Service Availability = \frac{1 - 60}{28 * 24 * 60}*100 = 99.85\% $$
```
:::

## Configuration

`@markee/mathjax` reads the `plugins.math` configuration.

`plugins.math.singleDollar` enables single-dollar inline math:

```yaml
plugins:
  math:
    singleDollar: true
```

With this enabled, inline formulas like `$E = mc^2$` are treated as math.
