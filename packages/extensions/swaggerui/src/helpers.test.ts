import { describe, expect, it } from 'vitest'

import {
  decodeRecord,
  decodeText,
  encodeText,
  escapeHtml,
  getClassList,
  getStringFromMeta,
  parseOpenApiSource,
  sanitizeFilterValue,
  toErrorMessage,
} from './helpers.js'

describe('swaggerui helpers', () => {
  it('encodes and decodes text values', () => {
    const encoded = encodeText('héllo <api>')

    expect(decodeText(encoded)).toBe('héllo <api>')
  })

  it('escapes html-sensitive characters', () => {
    expect(escapeHtml('&<>"')).toBe('&amp;&lt;&gt;&quot;')
  })

  it('formats unknown errors into messages', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
    expect(toErrorMessage('oops')).toBe('oops')
    expect(toErrorMessage({})).toBe('Unknown error')
  })

  it('extracts normalized string metadata and class lists', () => {
    expect(getStringFromMeta({ tag: ' users ' }, 'tag')).toBe('users')
    expect(getStringFromMeta({ tag: 12 }, 'tag')).toBe('12')
    expect(getStringFromMeta({ tag: true }, 'tag')).toBe('true')
    expect(getStringFromMeta({ tag: {} }, 'tag')).toBe('')
    expect(getStringFromMeta({}, 'tag')).toBe('')
    expect(getClassList({ class: 'one  two swagger' })).toEqual([
      'one',
      'two',
      'swagger',
    ])
    expect(getClassList({})).toEqual([])
  })

  it('decodes records defensively', () => {
    expect(decodeRecord()).toEqual({})
    expect(decodeRecord(encodeText(JSON.stringify({ tag: 'users' })))).toEqual({
      tag: 'users',
    })
    expect(decodeRecord(encodeText(JSON.stringify('nope')))).toEqual({})
    expect(decodeRecord('%%%')).toEqual({})
  })

  it('sanitizes filter values and parses json or yaml OpenAPI sources', () => {
    expect(sanitizeFilterValue(' "users" ')).toBe('users')
    expect(sanitizeFilterValue(" 'pets' ")).toBe('pets')
    expect(sanitizeFilterValue(' plain ')).toBe('plain')

    expect(parseOpenApiSource('{"openapi":"3.1.0"}')).toEqual({
      openapi: '3.1.0',
    })
    expect(parseOpenApiSource('openapi: 3.1.0\ninfo:\n  title: Demo')).toEqual({
      openapi: '3.1.0',
      info: { title: 'Demo' },
    })
    expect(() => parseOpenApiSource('- not-an-object')).toThrow(
      'OpenAPI source must parse to an object.',
    )
  })
})
