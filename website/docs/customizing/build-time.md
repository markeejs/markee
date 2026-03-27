# Build-time Plugins

In addition to client-side customizations, you can also define plugins that run during the build process.

Those plugins need to be `.js` or `.mjs` files, and need to be added inside the `_assets/_build` folder.

## What can build-time plugins do?

Build-time plugins are limited to minimal transforms on _code fences_ and _directives_. For any
advanced use-cases such as additional syntax or content transformation, only [client-side plugins](./scripts/markdown-plugins.md)
can be used.

## Creating a build-time plugin

A build-time plugin is a JavaScript file that exports pre-determined values:

- `name: string`: a unique name for the plugin. This is used to identify the plugin when preloading content and later retrieving it.
- `preloadFence?: (fence: Fence, params: Params, context: Context) => Promise<FenceReturn>`: a function that gets called for every code fence found in documents, and
  returns a promise that can either modify the fence's attributes, or return preloaded content, or both.
  
  The second parameter contains the plugin's options, as found in `markee.yaml` or the document's frontmatter. The third parameter contains explicit build-time context from the CLI.
- `preloadDirective?: (directive: Directive, params: Params, context: Context) => Promise<DirectiveReturn>`: a function that gets called for every directive found in documents, and
  returns a promise that can either modify the directive's attributes, or return preloaded content, or both.

  The second parameter contains the plugin's options, as found in `markee.yaml` or the document's frontmatter. The third parameter contains explicit build-time context from the CLI.

As soon as a JavaScript file placed in `_assets/_build` exports `name` and at least one of `preloadFence` or `preloadDirective`,
it will be automatically loaded during build-time.

Here are the detailed types of the parameters and returns:

```ts
interface Fence {
  // Raw content of the fence
  content: string
  // Detected language of the fence
  lang?: string
  // Attributes passed to the fence after the language, parsed as a key-value object
  attrs: Record<string, string | number | boolean>
}

interface Directive {
  // Raw content of the directive
  content: string
  // Type of directive
  type: string
  // Label of the directive
  label?: string
  // Attributes passed to the directive, parsed as a key-value object
  attrs: Record<string, string | number | boolean>
}

interface Context {
  // Current Markee command
  command: 'develop' | 'build' | 'serve' | 'init'
  // Current Markee mode
  mode: 'preview' | 'production'
}

interface FenceReturn {
  // New language to set to the fence, replacing the previous one
  lang?: string
  // New attributes to add to the fence. Will get shallow-merged with existing attributes.
  // `id` cannot be modified.
  attrs?: Record<string, string | number | boolean>
  // Preloaded content for that fence. Will be stored in a cache and accessible on the client.
  payload?: any
}

interface DirectiveReturn {
  // New type to set to the directive, replacing the previous one
  type?: string
  // New label to set to the directive, replacing the previous one
  label?: string
  // New attributes to add to the directive. Will get shallow-merged with existing attributes.
  // `id` cannot be modified.
  attrs?: Record<string, string | number | boolean>
  // Preloaded content for that directive. Will be stored in a cache and accessible on the client.
  payload?: any
}
```

Build-time plugins should use the explicit `context` argument when they need CLI state such as the active command or mode.
They should not rely on ambient globals such as `command`.

```js
export const name = 'example'

export async function preloadFence(fence, config, context) {
  if (context.command !== 'build') return

  return {
    attrs: {
      'data-mode': context.mode,
    },
  }
}
```

### Adding/mutating attributes

The first use of a build-time plugin is to add/mutate attributes on code fences and directives. For instance,
one could use it to replace all `warning` directives with `alert` directives.

To add/replace attributes, return an object with an `attrs` key, containing the new attributes. It will
get shallow-merged with existing attributes. You can set an attribute to `undefined` to remove it.

For fences, you can also change the language of the fence by returning an object with a `lang` key.

For directives, you can change the type and label by returning an object with a `type` and/or `label` key.

### Preloading content

The second use of a build-time plugin is to preload content for a fence or directive. Preloaded content can be any
valid JSON value and will be stored in a cache and accessible on the client.

For instance, one could detect all code fences where language is `mermaid`, and pre-render the SVG based on the
content of the fence.

It is then possible to access the preloaded content in a client plugin.

## Using preloaded content on the client

Preloaded content is accessible on the client through the `state.$payload` atom.
This atom exposes a `.for({ plugin, element })` helper that returns preloaded content
for the current element and plugin.

```js
const payload = state.$payload.get().for({
  plugin: 'kroki',
  element: this
})
```

:::note
`$payload` takes an `HTMLElement` instead of a raw `id` because it needs to find
its position in the layout to know if the preloaded content is linked to the main document or to a layout part.
:::

For directives turned into custom elements, `element: this` is usually enough.

You can check the source of our [official Kroki extension](../extensions/kroki.md) for a complete example
of using preloaded content.

## Opt-out files

Any file inside the `_assets/_build` folder will be lazy-loaded during build-time to check if 
they are build-time plugins.

You can opt-out some files from being lazy-loaded by prefixing them with `_`.
This can be useful to temporarily disable an extension while testing, or to create utility
files that are imported by your build-time scripts but are not needed on their own.
