import { beforeEach, describe, expect, it, vi } from 'vitest'

const noFilesState = vi.hoisted(() => ({
  loadLanguage: vi.fn(),
}))

vi.mock('@markee/runtime', async () => {
  const actual = await import('../../../runtime/custom-elements.js')
  return {
    ...actual,
    extend: {
      prism: {
        loadLanguage: noFilesState.loadLanguage,
      },
    },
  }
})

describe('markee-no-files', () => {
  beforeEach(() => {
    vi.resetModules()
    noFilesState.loadLanguage.mockClear()
    document.body.innerHTML = ''
  })

  it('renders the onboarding content and requests yaml syntax highlighting after update', async () => {
    await import('./no-files.js')

    const element = document.createElement(
      'markee-no-files',
    ) as HTMLElement & { updateComplete?: Promise<unknown> }
    document.body.append(element)
    await element.updateComplete

    expect(element.textContent).toContain('No file found')
    expect(element.textContent).toContain('markee.yaml')
    expect(element.querySelector('code')?.textContent).toBe('markee.yaml')
    expect(noFilesState.loadLanguage).toHaveBeenCalledWith('yaml')
  })
})
