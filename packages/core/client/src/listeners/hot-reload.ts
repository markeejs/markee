import { clearCache } from '@markee/state/cache.js'
import { revalidateMetadata } from '@markee/state/store/metadata.js'

let lastUpdate = -Infinity
let revalidateHead = async () => {}

const revalidate = async () => {
  const now = Date.now()
  const shouldUpdate = now - lastUpdate > 100
  lastUpdate = now

  if (shouldUpdate) {
    await revalidateHead()
    clearCache()
    void revalidateMetadata()
  }
}

let eventSource: EventSource
let close: () => void = () => {}

function handleEventSource(skipRevalidate = false) {
  const visible = !document.hidden
  if (visible) {
    eventSource = new EventSource('/_markee/sse')
    eventSource.addEventListener('fileChange', () => {
      lastUpdate = -Infinity
      void revalidate()
    })
    eventSource.addEventListener('error', () => {
      close()
      console.log('Hot-reload disconnected. Reconnecting...')
      setTimeout(() => handleEventSource(true), 500)
    })
    close = () => {
      eventSource.close()
      close = () => {}
    }

    if (!skipRevalidate) {
      requestAnimationFrame(revalidate)
    }
  } else {
    lastUpdate = Date.now()
    close()
  }
}

window.addEventListener('beforeunload', () => close())
document.addEventListener('visibilitychange', () => handleEventSource())
handleEventSource(true)

export async function loadHead() {
  const keys: Set<string> = new Set()
  let initial = true
  let prev: Record<string, string> = {}

  const anchor = document.createComment('')
  document.head.append(anchor)
  ;(window as any)[Symbol.for('markee::head-promises')] = {}

  revalidateHead = async () => {
    const head: {
      key: string
      kind: string
      html: string
      modified?: number
    }[] = await fetch('/_markee/head.json').then((res) => res.json())

    const prevKeys = new Set(keys)
    const toDelete: Element[] = []
    const promises: Promise<void>[] = []
    keys.clear()

    const fragments = head
      .map((h) => {
        prevKeys.delete(h.key)
        keys.add(h.key)

        if (h.kind === 'script') {
          const element = document.createElement('script')
          if (!h.key.endsWith('.cjs')) {
            promises.push(
              new Promise<void>((resolve) => {
                ;(window as any)[Symbol.for('markee::head-promises')][h.key] =
                  resolve
              }),
            )

            element.type = 'module'
            element.innerHTML = `
            await import("${h.key}?ts=${h.modified || Date.now()}");
            window[Symbol.for('markee::head-promises')]['${h.key}']();
            `
          } else {
            element.src = h.key
            promises.push(
              new Promise<void>((resolve) => {
                element.onload = resolve as any
              }),
            )
          }
          toDelete.push(...document.querySelectorAll(`[data-key="${h.key}"]`))
          element.dataset.key = h.key
          return element
        }

        if (h.kind === 'style') {
          const element = document.createElement('link')
          element.rel = 'stylesheet'
          element.href = h.key
          promises.push(
            new Promise<void>((resolve) => {
              element.onload = resolve as any
            }),
          )
          toDelete.push(...document.querySelectorAll(`[data-key="${h.key}"]`))
          element.dataset.key = h.key
          return element
        }

        if (!initial && prev[h.key] !== h.html) {
          window.location.reload()
        }

        prev[h.key] = h.html

        return initial
          ? document.createRange().createContextualFragment(h.html)
          : document.createDocumentFragment()
      })
      .filter(Boolean)

    initial = false
    anchor.after(...fragments)

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000))
    await Promise.race([timeoutPromise, Promise.allSettled(promises)])

    toDelete.forEach((elem) => elem.remove())
    prevKeys.forEach((key) => {
      if (prev[key]) {
        window.location.reload()
      }
      document
        .querySelectorAll(`[data-key="${key}"]`)
        .forEach((elem) => elem.remove())
    })
  }

  await revalidateHead()
}
