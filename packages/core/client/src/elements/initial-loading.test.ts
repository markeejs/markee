import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('markee-initial-loading', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
  })

  it('renders the initial indexing message and the preloading placeholder', async () => {
    await import('./initial-loading.js')

    const element = document.createElement(
      'markee-initial-loading',
    ) as HTMLElement & { updateComplete?: Promise<unknown> }
    document.body.append(element)
    await element.updateComplete

    expect(element.textContent).toContain(
      'The development server is still indexing files',
    )
    expect(element.querySelector('markee-preloading')).not.toBeNull()
  })
})
