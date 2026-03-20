import { beforeEach, describe, expect, it, vi } from 'vitest'

const draftWarningState = vi.hoisted(() => ({
  development: true,
  currentFile: null as any,
}))

vi.mock('@markee/runtime', async () => {
  const actual = await import('../../../runtime/custom-elements.js')
  return {
    ...actual,
    get development() {
      return draftWarningState.development
    },
    state: {
      $currentFile: {
        get: () => draftWarningState.currentFile,
        subscribe() {
          return () => {}
        },
      },
    },
  }
})

describe('markee-draft-warning', () => {
  beforeEach(() => {
    vi.resetModules()
    draftWarningState.development = true
    draftWarningState.currentFile = null
    document.body.innerHTML = ''
  })

  it('renders nothing when development mode is disabled or the current file is not a draft', async () => {
    await import('./draft-warning.js')

    draftWarningState.development = false
    const hidden = document.createElement(
      'markee-draft-warning',
    ) as HTMLElement & { updateComplete?: Promise<unknown> }
    document.body.append(hidden)
    await hidden.updateComplete
    expect(hidden.textContent).toBe('')

    draftWarningState.development = true
    draftWarningState.currentFile = { frontMatter: { draft: false } }
    const published = document.createElement(
      'markee-draft-warning',
    ) as HTMLElement & { updateComplete?: Promise<unknown> }
    document.body.append(published)
    await published.updateComplete
    expect(published.textContent).toBe('')
  })

  it('renders the draft warning message for draft files in development mode', async () => {
    await import('./draft-warning.js')

    draftWarningState.currentFile = { frontMatter: { draft: true } }

    const element = document.createElement(
      'markee-draft-warning',
    ) as HTMLElement & { updateComplete?: Promise<unknown> }
    document.body.append(element)
    await element.updateComplete

    expect(element.textContent).toContain('This document is marked as draft')
  })
})
