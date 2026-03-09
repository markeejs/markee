let raf = 0
export function scrollToRef(ref: HTMLElement) {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const viewport = ref.closest('markee-scroll-area [role="region"]')
    if (!viewport) return

    const { top, height } = viewport.getBoundingClientRect()

    const start = top
    const stop = start + height

    const { top: refTop, height: refHeight } = ref.getBoundingClientRect()

    const refStart = refTop
    const refEnd = refStart + refHeight

    if (refEnd > stop || refStart < start) {
      viewport.scrollTop = refTop - top - height / 2 + refHeight / 2
    } else if (height === 0) {
      scrollToRef(ref)
    }
  })
}
