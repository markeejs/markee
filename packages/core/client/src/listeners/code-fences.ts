import prism from 'prismjs'

/**
 * Apply Prism highlighting to all required targets
 */
function applyPrismHighlight() {
  observer.disconnect()

  const fences = document.querySelectorAll<HTMLElement>('pre > code')
  fences.forEach((fence) => {
    if (!fence.firstElementChild) {
      prism.highlightElement(fence)
    }
  })

  document
    .querySelectorAll<HTMLButtonElement>(
      '.code-toolbar .toolbar .copy-to-clipboard-button',
    )
    .forEach((button) => {
      button.title = 'Copy to clipboard'
    })
  observer.observe(document.body, { childList: true, subtree: true })
}

const observer = new MutationObserver(applyPrismHighlight)
applyPrismHighlight()

window.addEventListener('markee:prism-language-loaded', applyPrismHighlight)
