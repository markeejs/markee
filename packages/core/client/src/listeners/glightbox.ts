/**
 * Apply GLightBox on all targets
 */
let cleanup: () => void = () => {}
export function applyGlightbox() {
  setTimeout(async () => {
    cleanup()
    const candidates =
      document.querySelectorAll<HTMLAnchorElement>('a.glightbox')

    if (candidates.length) {
      const GLightbox = (await import('glightbox')).default
      const lightbox = GLightbox({
        touchNavigation: true,
        loop: true,
        autoplayVideos: true,
      })

      candidates.forEach((anchor, i) => {
        anchor.addEventListener('click', (e) => {
          e.stopImmediatePropagation()
          e.preventDefault()
          lightbox.openAt(i)
        })
      })

      cleanup = () => lightbox.destroy()
    }
  })
}

const mutationObserver = new MutationObserver(applyGlightbox)
mutationObserver.observe(document.body, { childList: true, subtree: true })
