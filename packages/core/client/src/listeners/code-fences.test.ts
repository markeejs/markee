import { beforeEach, describe, expect, it, vi } from 'vitest'

const codeFenceState = vi.hoisted(() => ({
  highlightElement: vi.fn(),
  observed: vi.fn(),
  disconnected: vi.fn(),
  callback: undefined as undefined | (() => void),
}))

vi.mock('prismjs', () => ({
  default: {
    highlightElement: codeFenceState.highlightElement,
  },
}))

class FakeMutationObserver {
  constructor(callback: () => void) {
    codeFenceState.callback = callback
  }

  observe(...args: any[]) {
    codeFenceState.observed(...args)
  }

  disconnect() {
    codeFenceState.disconnected()
  }
}

describe('code-fences listener', () => {
  beforeEach(() => {
    vi.resetModules()
    codeFenceState.highlightElement.mockClear()
    codeFenceState.observed.mockClear()
    codeFenceState.disconnected.mockClear()
    codeFenceState.callback = undefined
    ;(globalThis as any).MutationObserver = FakeMutationObserver
    document.body.innerHTML = `
      <pre><code id="plain">alpha</code></pre>
      <pre><code id="nested"><span>beta</span></code></pre>
      <div class="code-toolbar">
        <div class="toolbar">
          <button class="copy-to-clipboard-button"></button>
        </div>
      </div>
    `
  })

  it('highlights plain code fences, updates copy buttons, and re-runs on prism language load', async () => {
    await import('./code-fences.js')

    expect(codeFenceState.disconnected).toHaveBeenCalledTimes(1)
    expect(codeFenceState.highlightElement).toHaveBeenCalledTimes(1)
    expect(codeFenceState.highlightElement).toHaveBeenCalledWith(
      document.getElementById('plain'),
    )
    expect(
      document.querySelector<HTMLButtonElement>('.copy-to-clipboard-button')?.title,
    ).toBe('Copy to clipboard')
    expect(codeFenceState.observed).toHaveBeenCalledWith(document.body, {
      childList: true,
      subtree: true,
    })

    window.dispatchEvent(new Event('markee:prism-language-loaded'))
    expect(codeFenceState.highlightElement).toHaveBeenCalledTimes(2)
  })
})
