# Markdown Plugins

Custom layouts and elements are often enough, but some projects need custom Markdown syntax as well.
For that case, Markee lets you extend the Markdown-to-HTML pipeline directly.

Markee's Markdown-to-HTML pipeline is built on [Unified](https://unifiedjs.com/).
It is a two-step pipeline: Markdown is processed with [remark](https://github.com/remarkjs/remark), then HTML is processed with [rehype](https://github.com/rehypejs/rehype).

You can register custom plugins for both the Remark and Rehype part of the pipeline. Registering plugins is
done through the `extend.markdownPipeline` object exported by `@markee/runtime`.

## Registering a Remark plugin

You can register a Remark plugin through the `extend.markdownPipeline.remark` function. This function
takes a unique key as first parameter, a Remark plugin as a second parameter, and any customization parameters
as needed by the plugin in subsequent parameters.

The plugins already registered at that point will be [Remark GFM](https://github.com/remarkjs/remark-gfm) and
[Remark Directive](https://github.com/remarkjs/remark-directive). Therefore, your plugin can build on top of those
two plugins.

:::note
For compatibility reasons, only block and leaf directives are enabled. Text directives are not available.
:::

For instance, you could use the following plugin to handle the `::youtube` example from Remark Directive:

```js
import { extend } from '@markee/runtime'

function youtubeRemark() {
  return (tree, file) => {
    extend.markdownPipeline.visit(tree, (node) => {
      if (node.type === 'leafDirective') {
        if (node.name !== 'youtube') return

        const data = node.data || (node.data = {})
        const attributes = node.attributes || {}
        const id = attributes.id

        if (!id) {
          file.fail('Unexpected missing `id` on `youtube` directive', node)
        }

        data.hName = 'iframe'
        data.hProperties = {
          src: 'https://www.youtube.com/embed/' + id,
          width: 200,
          height: 200,
          frameBorder: 0,
          allow: 'picture-in-picture',
          allowFullScreen: true
        }
      }
    })
  }
}

extend.markdownPipeline.remark('youtube', youtubeRemark)
```

You will notice that `extend.markdownPipeline` exposes the `visit` utility from [unist-util-visit](https://www.npmjs.com/package/unist-util-visit).
This helper is needed in most Unified plugins, so Markee exposes it directly instead of requiring each plugin to import its own copy.

## Registering a Rehype plugin

You can also define a Rehype plugin to transform the HTML AST before it gets stringified. When your Rehype plugin runs,
the Markdown AST will already have been transformed into HTML AST.

Rehype plugins let you manipulate the HTML tree directly without the abstraction of Markdown syntax.

For instance, you could decide to append `target="_blank"` to all external links.

```js
extend.markdownPipeline.rehype('external-links', () => (tree) => {
    extend.markdownPipeline.visit(tree, 'element', (node) => {
        if (node.tagName === 'a' && node.properties.href.startsWith('http')) {
            node.properties.target = "_blank"
        }
    })
})
```

## Hot Reload

The unique key passed as first parameter is used in development to provide hot-reload capabilities. Your plugin
implementation will be swapped automatically when the script file changes.

## Reading configuration

If you want to offer configuration for your plugin, you can access the Remark/Rehype Processor's data to get
the general site config as well as the current document front-matter easily.

:::warning
Do not read the front-matter from `state.$currentFile` as this will not be accurate during preloading of content.
:::

The general site config will be accessible from `this.data().config`, while the file front-matter is available 
from `this.data().frontMatter`:

```js
import { extend } from '@markee/runtime'

/* 
 * Supported config:
 * plugins:
 *   externalLinks: false
 * 
 * plugins:
 *   externalLinks:
 *     enabled: false
 */
extend.markdownPipeline.rehype('external-links', function () {
  const fromConfig = this.data().config?.plugins?.externalLinks
  const fromFrontMatter = this.data().frontMatter?.plugins?.externalLinks
  const resolved = fromFrontMatter ?? fromConfig ?? true
  const enabled = typeof resolved === 'boolean' ? resolved : resolved.enabled
  
  return (tree) => {
    if (enabled) {
      extend.markdownPipeline.visit(tree, 'element', (node) => {
        if (node.tagName === 'a' && node.properties.href.startsWith('http')) {
          node.properties.target = "_blank"
        }
      })
    }
  }
})
```

Or you can use the `pluginConfig` shorthand to automatically extract the plugin configuration from the front-matter or
the general site config:

```js
import { extend } from '@markee/runtime'

/* 
 * Supported config:
 * plugins:
 *   externalLinks: false
 * 
 * plugins:
 *   externalLinks:
 *     enabled: false
 */
extend.markdownPipeline.rehype('external-links', function () {
  const resolved = this.data().pluginConfig('externalLinks') ?? true
  const enabled = typeof resolved === 'boolean' ? resolved : resolved.enabled
  
  return (tree) => {
    if (enabled) {
      extend.markdownPipeline.visit(tree, 'element', (node) => {
        if (node.tagName === 'a' && node.properties.href.startsWith('http')) {
          node.properties.target = "_blank"
        }
      })
    }
  }
})
```
