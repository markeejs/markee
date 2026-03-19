import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/runtime'
import { MarkeeRevisionDate } from './markee-revision-date'

const runtimeState = {
  current: { data: null, error: null, loading: false } as ReturnType<
    typeof state.$currentLoader.get
  >,
  navigation: { files: {} as Record<string, any> },
}

beforeEach(() => {
  runtimeState.current = { data: null, error: null, loading: false }
  runtimeState.navigation = { files: {} }

  vi.restoreAllMocks()
  vi.spyOn(state.$currentLoader, 'get').mockImplementation(
    () => runtimeState.current,
  )
  vi.spyOn(state.$currentLoader, 'subscribe').mockImplementation(() => () => {})
  vi.spyOn(state.$navigation, 'get').mockImplementation(
    () => runtimeState.navigation as any,
  )
  vi.spyOn(state.$navigation, 'subscribe').mockImplementation(() => () => {})
})

function normalizeText(text: string | null | undefined) {
  return (text ?? '').replace(/\u00a0/g, ' ').trim()
}

describe('markee-revision-date', () => {
  it('renders nothing when there is no current file revision date', async () => {
    const element = new MarkeeRevisionDate()
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelector('span')).toBeNull()
    expect(normalizeText(element.textContent)).toBe('')
  })

  it('renders the default label and formatted revision date for the current file', async () => {
    runtimeState.current = {
      data: { key: 'docs/current.md' } as any,
      error: null,
      loading: false,
    }
    runtimeState.navigation = {
      files: {
        'docs/current.md': {
          revisionDate: '2024-01-05T00:00:00.000Z',
        },
      },
    }

    const element = new MarkeeRevisionDate()
    document.body.append(element)

    await element.updateComplete

    const expectedDate = new Intl.DateTimeFormat(
      element.labelLang,
      JSON.parse(element.format),
    ).format(new Date('2024-01-05T00:00:00.000Z'))

    expect(normalizeText(element.textContent)).toBe(
      `Last updated: ${expectedDate}`,
    )
  })

  it('uses the custom label, language, and format configuration', async () => {
    runtimeState.current = {
      data: { key: 'docs/current.md' } as any,
      error: null,
      loading: false,
    }
    runtimeState.navigation = {
      files: {
        'docs/current.md': {
          revisionDate: '2024-01-05T00:00:00.000Z',
        },
      },
    }

    const element = new MarkeeRevisionDate()
    element.label = 'Mise a jour:'
    element.labelLang = 'fr-CA'
    element.format = '{"year":"numeric"}'
    document.body.append(element)

    await element.updateComplete

    expect(normalizeText(element.textContent)).toBe('Mise a jour: 2024')
  })
})
