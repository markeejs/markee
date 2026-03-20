import { describe, expect, it } from 'vitest'

import { resolveActiveFilter, validateFilter } from './filters.js'

describe('swaggerui filters', () => {
  it('resolves the active filter from tag, operation, or schema', () => {
    expect(
      resolveActiveFilter({ tag: ' users ', operation: '', schema: '' }),
    ).toEqual({ type: 'tag', value: 'users' })
    expect(
      resolveActiveFilter({ tag: '', operation: 'get /pets', schema: '' }),
    ).toEqual({ type: 'operation', value: 'get /pets' })
    expect(
      resolveActiveFilter({ tag: '', operation: '', schema: '"Pet"' }),
    ).toEqual({ type: 'schema', value: 'Pet' })
    expect(
      resolveActiveFilter({ tag: '', operation: '', schema: '' }),
    ).toBeNull()
    expect(() =>
      resolveActiveFilter({ tag: 'users', operation: 'get /pets', schema: '' }),
    ).toThrow('Use only one filter per fence')
  })

  it('validates tag and operation filters against the spec', () => {
    const spec = {
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            tags: ['Users'],
          },
          parameters: [],
        },
        '/status': {
          post: {
            operationId: 'updateStatus',
            tags: ['Admin'],
          },
        },
      },
    }

    expect(validateFilter(spec, { type: 'tag', value: 'users' })).toEqual({
      type: 'tag',
      value: 'users',
    })
    expect(
      validateFilter(spec, { type: 'operation', value: 'GET /pets' }),
    ).toEqual({
      type: 'operation',
      value: 'GET /pets',
    })
    expect(
      validateFilter(spec, { type: 'operation', value: 'updateStatus' }),
    ).toEqual({
      type: 'operation',
      value: 'updateStatus',
    })
    expect(() =>
      validateFilter(spec, { type: 'tag', value: 'missing' }),
    ).toThrow('No operations matched tag "missing".')
    expect(() =>
      validateFilter(spec, { type: 'operation', value: 'delete /pets' }),
    ).toThrow('No operations matched operation "delete /pets".')
  })

  it('handles empty selectors and malformed path entries defensively', () => {
    const malformedSpec = {
      paths: {
        '/skip-null': null,
        '/skip-method': {
          parameters: [],
          get: null,
        },
        '/health': {
          get: {},
        },
      },
      components: {
        schemas: null,
      },
      definitions: null,
    }

    expect(() =>
      validateFilter(malformedSpec, { type: 'tag', value: ' ' }),
    ).toThrow('No operations matched tag " ".')
    expect(() =>
      validateFilter(malformedSpec, { type: 'operation', value: ' ' }),
    ).toThrow('No operations matched operation " ".')
    expect(
      validateFilter(malformedSpec, { type: 'operation', value: '/health' }),
    ).toEqual({
      type: 'operation',
      value: '/health',
    })
    expect(() =>
      validateFilter(malformedSpec, { type: 'schema', value: ' ' }),
    ).toThrow('Schema " " was not found.')
  })

  it('rejects invalid paths containers and non-array tag collections', () => {
    expect(() =>
      validateFilter(
        { paths: 'invalid' as unknown as Record<string, never> },
        { type: 'operation', value: '/pets' },
      ),
    ).toThrow('No operations matched operation "/pets".')

    expect(() =>
      validateFilter(
        {
          paths: {
            '/pets': {
              get: {
                tags: 'users',
              },
            },
          },
        },
        { type: 'tag', value: 'users' },
      ),
    ).toThrow('No operations matched tag "users".')
  })

  it('validates schema filters against components or definitions', () => {
    expect(
      validateFilter(
        {
          components: {
            schemas: {
              Pet: {},
            },
          },
        },
        { type: 'schema', value: 'pet' },
      ),
    ).toEqual({
      type: 'schema',
      value: 'Pet',
    })

    expect(
      validateFilter(
        {
          definitions: {
            User: {},
          },
        },
        { type: 'schema', value: 'user' },
      ),
    ).toEqual({
      type: 'schema',
      value: 'User',
    })

    expect(() =>
      validateFilter(
        {
          paths: null,
        },
        { type: 'schema', value: 'missing' },
      ),
    ).toThrow('Schema "missing" was not found.')
    expect(validateFilter({}, null)).toBeNull()
  })
})
