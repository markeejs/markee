# Custom Elements

The recommended way to add custom functionality to your website, mostly through your layouts, is using 
[custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).

The main benefit of this approach is that your logic is scoped to a specific element instance,
and runs only when that instance is added to the DOM ("connected" in custom element terms).

## Creating a custom element

The recommended way to create a Markee custom element is to use the `MarkeeElement` class, and Lit as a rendering engine.
You can import `MarkeeElement` from `@markee/runtime`, and Lit from `lit` directly.

The `MarkeeElement` class is a wrapper around Lit `LitElement`, with some added helpers for listening to
a nanostores atom, as well as easily adding an ARIA role since most custom elements added to Markee sites
will have a semantic role to play.

`MarkeeElement` instances also have a `tag` helper for easily registering your custom element.

```js
import { html } from 'lit'
import { state, MarkeeElement } from '@markee/runtime'

class HelloWorld extends MarkeeElement.with({
  role: 'article',
  stores: [state.$currentFile]
}) {
 render() {
   // Render will autamtically be called again
   // whenever the currentFile atom changes
   return html`<div>
    Hello, ${state.$currentFile.get()?.key}!
   </div>`
 }
}

HelloWorld.tag('hello-world')
```

## Hot Reload

In development mode, saving your script file will automatically swap implementation of rendered elements.
Do not wrap your `customElements.define`/`Element.tag` call in a `if (!customElements.get('my-custom-element'))` check, 
or you will lose that functionality. Markee already does that check for you.
