# @markee/mathjax

Markee extension for MathJax-based math rendering.

Full Markee documentation at https://markee.dev/

## Install

```bash
pnpm add @markee/mathjax
```

## How to use

Add the extension to your `markee.yaml`:

```yaml
extensions:
  - '@markee/mathjax'
```

Then write display math with `$$ ... $$`:

```markdown
$$ E = mc^2 $$
```

Set `plugins.math.singleDollar: true` if you want `$...$` inline math syntax.

## Notes

This package ships a Markee extension bundle through `extension.yaml` together with the runtime assets required to render mathematical notation in Markee content.
