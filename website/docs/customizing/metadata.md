# Metadata

If you need to inject things into your document's `head` which aren't styles or scripts, you can add a `.html` document
inside your `_assets/_head` folder, or create a `_assets/_head.html` file.

Whatever HTML code you put inside that file will be appended to your HTML `head`.

This can be used for:

- Meta tags
- Open Graph tags
- Import maps
- Or any other HTML valid inside a `head` tag

## Hot Reload

HTML fragments are never hot-reloaded. They are injected once on first render, then are kept the same. They will require
a manual page refresh to get updated.
