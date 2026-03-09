# Custom JavaScript

Just as for styles, you can add custom scripts to be injected in your HTML's `head` by placing `.js` or `.mjs`
files in the `_assets/_head` folder. Files are added in alphabetical order, and files higher in the filesystem
tree are inserted first.

## ECMAScript Modules

Markee embraces [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) to
keep runtime code standards-based and composable.

All `.js` and `.mjs` files will be injected as `type="module"` scripts. Inside those files, you 
will be able to use `import`/`export` statements, and you can use `await` and `async` functions, as
well as top-level `await`.

## Available modules

The bundled client exposes modules through an import map that you can use in your scripts.

[Import maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) let you import
those modules through their package name like you would in a Node.js or bundled project.

- **`@markee/runtime`:**
  :::div{style='margin-block: -1rem 1rem;'}
  Exposes Markee runtime APIs for custom scripts: shared state (`state`), runtime hooks (`extend.search`, `extend.navigation`, `extend.prism`), Markdown pipeline extension hooks (`extend.markdownPipeline`), and custom element helpers (`MarkeeElement`, converters). See [Shared State](./shared-state.md), [Runtime Hooks](./extend-hooks.md), [Markdown Plugins](./markdown-plugins.md), and [Custom Elements](./elements.md) for details.
  :::
- **`nanostores`, `@nanostores/persistent`:**
  :::div{style='margin-block: -1rem 1rem;'}
  Markee's state uses [nanostores](https://github.com/nanostores/nanostores) under the hood. `nanostores` and `@nanostores/persistent` are exposed for convenience in case you need to build your own state.
  :::
- **`lit`, `@nanostores/lit`:**
  :::div{style='margin-block: -1rem 1rem;'}
  Markee's default custom elements use [lit](https://lit.dev/). Lit is exposed so that you can use it to build your own custom elements. The nanostores lit wrapper is also available to connect your custom elements to Markee's state or your custom state.
  :::

## Hot-reload

In development mode, your scripts will be automatically swapped when they are updated, allowing you to see your changes
live in the browser.

## Bundling

If you are building larger custom scripts or extension assets, you can bundle them with Vite while keeping Markee-compatible runtime imports.
See [Bundling Scripts](./bundling.md) for setup details and caveats.

## UI primitives

Markee includes low-level UI primitives (select, drawer, tooltip, hovercard, and more) that can be reused in custom layouts.
See [UI Primitives](./ui-primitives.md).

## Opt-out files

You can opt-out some files from being injected in the `<head>` by prefixing them with `_`. This is mostly useful for
files containing utility functions aimed at being imported in other modules, which do not need to be loaded on their 
own.

You can also place JS files outside the `_assets/_head` folder. They are still importable, but they
will not be injected in the `<head>`.
