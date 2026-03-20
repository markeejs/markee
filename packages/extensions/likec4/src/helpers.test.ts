import { describe, expect, it } from 'vitest'

import {
  MAX_VIEW_HEIGHT,
  countViewDeclarations,
  decodeText,
  encodeText,
  escapeHtml,
  getBooleanFromMeta,
  getStringFromMeta,
  hasClass,
  normalizeMaxHeight,
  toErrorMessage,
} from './helpers.js'

describe('@markee/likec4 helpers', () => {
  it('encodes, decodes, escapes, and formats errors', () => {
    expect(decodeText(encodeText('héllo <c4>'))).toBe('héllo <c4>')
    expect(escapeHtml('&<>')).toBe('&amp;&lt;&gt;')
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
    expect(toErrorMessage('oops')).toBe('oops')
    expect(toErrorMessage({})).toBe('Unknown error')
    expect(MAX_VIEW_HEIGHT).toBe('32rem')
  })

  it('reads metadata booleans, classes, and max-height values', () => {
    const meta = { class: 'on-glb compact', zoom: 'true', pan: 'off', id: 4 }

    expect(getStringFromMeta(meta, 'id')).toBe('4')
    expect(getBooleanFromMeta(meta, 'zoom')).toBe(true)
    expect(getBooleanFromMeta(meta, 'pan', true)).toBe(false)
    expect(hasClass(meta, 'compact')).toBe(true)
    expect(normalizeMaxHeight(' 20rem ')).toBe('20rem')
    expect(normalizeMaxHeight('100')).toBe('')
    expect(normalizeMaxHeight(undefined)).toBe('')
  })

  it('counts LikeC4 view declarations while ignoring comments', () => {
    const source = `
      // view one {
      view first {
      }
      /* view second { } */
      view second {
      }
    `

    expect(countViewDeclarations(source)).toBe(2)
  })
})
