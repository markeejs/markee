import { describe, expect, it } from 'vitest'

import {
  decodeText,
  encodeText,
  escapeHtml,
  getBooleanFromMeta,
  getClassList,
  getStringFromMeta,
  hasClass,
  toErrorMessage,
} from './helpers.js'

describe('@markee/diagrams helpers', () => {
  it('encodes and decodes text values', () => {
    const encoded = encodeText('héllo <diagram>')
    expect(decodeText(encoded)).toBe('héllo <diagram>')
  })

  it('formats errors and escapes html', () => {
    expect(escapeHtml('&<>"')).toBe('&amp;&lt;&gt;&quot;')
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
    expect(toErrorMessage('oops')).toBe('oops')
    expect(toErrorMessage({})).toBe('Unknown error')
  })

  it('reads metadata strings, classes, booleans, and class presence', () => {
    const meta = {
      class: 'one two on-glb',
      truthy: 'yes',
      falsy: 'off',
      num: 3,
      invalid: {},
    }

    expect(getStringFromMeta(meta, 'class')).toBe('one two on-glb')
    expect(getStringFromMeta(meta, 'num')).toBe('3')
    expect(getStringFromMeta(meta, 'missing')).toBe('')
    expect(getStringFromMeta(meta, 'invalid')).toBe('')
    expect(getClassList(meta)).toEqual(['one', 'two', 'on-glb'])
    expect(getClassList({})).toEqual([])
    expect(getBooleanFromMeta(meta, 'truthy')).toBe(true)
    expect(getBooleanFromMeta({ enabled: 'enabled' }, 'enabled')).toBe(true)
    expect(getBooleanFromMeta({ disabled: '0' }, 'disabled', true)).toBe(false)
    expect(getBooleanFromMeta(meta, 'falsy', true)).toBe(false)
    expect(getBooleanFromMeta({ maybe: 'unknown' }, 'maybe', true)).toBe(true)
    expect(hasClass(meta, 'two')).toBe(true)
    expect(hasClass(meta, 'missing')).toBe(false)
    expect(hasClass({ class: true }, 'two')).toBe(false)
  })
})
