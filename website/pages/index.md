---
title: 'Home'
class: home
---

<script>
document.title = 'Markee'
</script>

::::section{#hero}
# [Markdown in,]{} [Website out.]{}

Build sites for the modern web, using Markdown, filesystem-routing and a powerful layout system.

[Get Started](../docs/getting-started/installation.md){.btn.btn-primary}
[Visit Blog](../blog/index.md){.btn}
::::

::::::section{#routing.feature}
:::div
## Intuitive Filesystem Routing

Stop wrestling with router configuration files.

Markee mirrors your directory structure to automatically generate URLs. Create a file and start writing.

[Learn more about routing](../docs/configuration/navigation.md){.btn.btn-cta}
:::

:::::div
::::div{.fs-visualizer}
:::div{.fs-row }
::span[📁 docs/]{.fs-file}
:::

:::div{.fs-row style="padding-left:2rem"}
::span[📄 index.md]{.fs-file}
::span[→]{.fs-arrow}
::span[/docs]{.fs-url}
::span
:::
:::div{.fs-row style="padding-left:2rem"}
::span[📄 setup.md]{.fs-file}
::span[→]{.fs-arrow}
::span[/docs/setup]{.fs-url}
::span
:::

:::div{.fs-row }
::span[📁 blog/]{.fs-file}
:::

:::div{.fs-row style="padding-left:2rem"}
::span[📄 article-1.md]{.fs-file}
::span[→]{.fs-arrow}
::span[/blog/article-1]{.fs-url}
::span
:::
:::div{.fs-row style="padding-left:2rem"}
::span[📄 article-2.md]{.fs-file}
::span[→]{.fs-arrow}
::span[/blog/article-2]{.fs-url}
::span
:::
::::
:::::
::::::

::::section{#pipeline.feature}
:::div
## Dual-Pipeline Powerhouse

Markdown-to-Markdown through **MarkdownIt** at build time for sanitation and preloading.

Markdown-to-HTML through **Remark/Rehype** on the client for dynamic HTML hydration.

Hook into either stage to inject custom logic, components, or analytics.

[Pipeline documentation](../docs/customizing/scripts/markdown-plugins.md){.btn.btn-cta}
:::

:::div
::div[Markdown File]{style="background:#1e293b; color:white; padding:1rem 2rem; border-radius: 12px;"}
::div[↓&nbsp;&nbsp;Build Time <em>(MarkdownIt)</em>&nbsp;&nbsp;↓]{style="color:var(--mk-color-primary);"}
::div[Sanitized Markdown Content]{style="background:var(--mk-flow-color-background-element); border:2px solid var(--mk-color-primary); padding:1rem 2rem; border-radius: 12px;"}
::div[↓&nbsp;&nbsp;Client Side <em>(Remark-Rehype)</em>&nbsp;&nbsp;↓]{style="color:var(--mk-flow-color-secondary);"}
::div[Finalized HTML]{style="background:linear-gradient(135deg, var(--mk-color-primary), var(--mk-flow-color-secondary)); color:white; padding:1rem 2rem; border-radius: 12px; box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);"}
:::
::::

:::::section{#layout.feature}
:::div
## Shared Layout System

Don't repeat yourself. Define your outer structure once—headers, sidebars, and footers—and let Markee inject your content into the central document slot.

Omit any slot, and compose any layout you want: documentation, blog, landing page...

[Learn about layout](../docs/configuration/layouts/layouts.md){.btn.btn-cta}
:::
::::div
:::div{.layout-grid-visual}
::div[Header]{.lg-part.lg-head}
::div[Left]{.lg-part.lg-left}
::div[Top]{.lg-part.lg-top}
::div[Document]{.lg-part.lg-doc}
::div[Bottom]{.lg-part.lg-bottom}
::div[Right]{.lg-part.lg-right}
::div[Footer]{.lg-part.lg-foot}
:::
::::
:::::

## First-class Extension Support

::::section{#extensibility.feature}
:::div
### Inject Custom Content

Need specific styles or interactive widget scripts placed in your document's `<head>`?
Markee makes injection trivial.
::: 
:::div
```html title=_partials/_head.html
<script
  type="module"
  src="https://cdn.some-library.com/script.js"
>
</script>
<link
  rel="stylesheet"
  href="https://cdn.some-library.com/style.css"
/>
```
:::
::::

:::section{#flow}
## Ready to get into the flow?

Stop fighting your tools and start shipping content.

[Start Building Now](../docs/getting-started/installation.md){.btn.btn-primary}
:::
