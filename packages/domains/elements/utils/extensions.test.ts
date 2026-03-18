import { afterEach, describe, expect, it, vi } from 'vitest'
import { extend } from '@markee/runtime'

import { safelyRun } from './extensions'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('safelyRun', () => {
  it('returns the callback result when no error is thrown', () => {
    expect(safelyRun(() => 'value', 'fallback')).toBe('value')
  })

  it('logs the extension function name from the stack and returns the fallback', () => {
    let error
    extend.search.getShardingKeys = () => {
      error = new Error('boom')
      throw error
    }

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(safelyRun(extend.search.getShardingKeys, 'fallback' as never)).toBe(
      'fallback',
    )

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('search.getShardingKeys'),
    )
    expect(errorSpy).toHaveBeenCalledWith(error)
  })

  it('logs a generic message when no stack is available', () => {
    const error = { message: 'boom' }
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(
      safelyRun(() => {
        throw error
      }, 'fallback'),
    ).toBe('fallback')

    expect(logSpy).toHaveBeenCalledWith(
      'An error occurred in a provided extension function',
    )
    expect(errorSpy).toHaveBeenCalledWith(error)
  })
})
