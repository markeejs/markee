# UI Primitives

Markee ships with low-level UI custom elements used by built-in components.
You can also use them directly in your own layouts and custom elements.

## `markee-select` and `markee-option`

Custom dropdown/select primitives.

### `markee-select` attributes

- `value`: selected option value.
- `placeholder`: text shown when no option is selected.
- `display-html`: when set, selected option is rendered as HTML.
- `disabled`: disable interaction.

### `markee-option` attributes

- `value`: option value.
- `disabled`: disable option.
- `selected`: selection state.

### Example

```markdown
<markee-select value="docs" placeholder="Select section">
  <markee-option value="docs">Documentation</markee-option>
  <markee-option value="blog">Blog</markee-option>
</markee-select>
```

## `markee-drawer`

Popover-based drawer component.

### Attributes

- `side="left|right"`: drawer side. Defaults to `left`.

### Example

```markdown
<markee-drawer side="right">
  <button slot="button">Menu</button>
  <nav>
    <a href="/docs">Docs</a>
    <a href="/blog">Blog</a>
  </nav>
</markee-drawer>
```

## `markee-collapse`

Simple collapsible container wrapper used for height/overflow transitions.

```markdown
<markee-collapse>
  <div>Collapsible content</div>
</markee-collapse>
```

## `markee-scroll-area`

Scrollable container with active/dragging state hooks, for custom scrollbar sytling.

```markdown
<markee-scroll-area style="max-height: 18rem;">
  <!-- Long content -->
</markee-scroll-area>
```

## `markee-tooltip`

Anchored tooltip.

### Attributes

- `for`: ID of the anchor element.
- `label`: tooltip text.
- `placement`: floating-ui placement (`top`, `bottom`, etc.).
- `disabled`: disable tooltip behavior.

```markdown
<button id="tip-target">Hover me</button>
<markee-tooltip for="tip-target" label="Tooltip content"></markee-tooltip>
```

## `markee-hovercard`

Anchored floating card.

### Attributes

- `for`: ID of the anchor element.
- `placement`: floating-ui placement (`bottom-start` by default).
- `disabled`: disable hovercard behavior.

```markdown
<button id="card-target">Details</button>
<markee-hovercard for="card-target">
  <div>Custom hovercard content</div>
</markee-hovercard>
```
