import prism from 'prismjs'

/**
 * Apply Prism highlighting to all required targets
 */
export function applyPrismHighlight() {
  return
  const apply = () => {
    prism.highlightAll()
    document
      .querySelectorAll<HTMLButtonElement>(
        '.code-toolbar .toolbar .copy-to-clipboard-button',
      )
      .forEach((button) => {
        button.title = 'Copy to clipboard'
      })
  }
  document.querySelectorAll('pre').forEach((pre) => console.log(pre.innerHTML))
  // Run apply after a delay to avoid some race conditions
  requestAnimationFrame(apply)
}
