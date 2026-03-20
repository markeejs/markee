import { describe, expect, it, vi } from 'vitest'
import { codes, types } from 'micromark-util-symbol'

import { micromarkGenericTag } from './micromark.js'

function createTokenizer() {
  const extension = micromarkGenericTag({
    name: 'mark',
    character: 'equalsTo',
  })

  return extension.text[String(codes.equalsTo)] as {
    tokenize: Function
    resolveAll: Function
  }
}

function createEvent(type: string, start: number, end: number, extra?: object) {
  return [
    'enter',
    {
      type,
      start: { offset: start },
      end: { offset: end },
      ...extra,
    },
    {},
  ] as any
}

function runTokenizer(
  previous: number | null,
  lastEventType: string,
  input: Array<number | null>,
) {
  const tokenizer = createTokenizer()
  const token = {
    type: 'markSequenceTemporary',
    start: { offset: 0 },
    end: { offset: 2 },
  } as any
  const effects = {
    enter: vi.fn(() => token),
    consume: vi.fn(),
    exit: vi.fn(() => token),
  }
  const ok = vi.fn((code) => ({ status: 'ok', code }))
  const nok = vi.fn((code) => ({ status: 'nok', code }))

  let state = tokenizer.tokenize.call(
    { previous, events: [['enter', { type: lastEventType }, {}]] },
    effects,
    ok,
    nok,
  )
  let result: any

  for (const code of input) {
    result = state(code)
    if (typeof result === 'function') {
      state = result
    }
  }

  return { effects, ok, nok, result, token }
}

describe('micromarkGenericTag', () => {
  it('exposes tokenizer hooks for the configured attention marker', () => {
    const extension = micromarkGenericTag({
      name: 'mark',
      character: 'equalsTo',
    })
    const tokenizer = extension.text[String(codes.equalsTo)]

    expect(tokenizer).toBe(extension.insideSpan.null[0])
    expect(extension.attentionMarkers.null).toEqual([codes.equalsTo])
  })

  it('tokenizes a valid opening sequence and marks it as open-only when followed by plain text', () => {
    const { effects, token, result } = runTokenizer(
      '_'.codePointAt(0) ?? null,
      types.data,
      [codes.equalsTo, codes.equalsTo, 'a'.codePointAt(0)!],
    )

    expect(effects.enter).toHaveBeenCalledWith('markSequenceTemporary')
    expect(effects.consume).toHaveBeenCalledTimes(2)
    expect(effects.exit).toHaveBeenCalledWith('markSequenceTemporary')
    expect(token._open).toBe(true)
    expect(token._close).toBe(false)
    expect(result).toEqual({ status: 'ok', code: 'a'.codePointAt(0) })
  })

  it('tokenizes an escaped sequence and marks it as close-only when preceded by plain text', () => {
    const { token, result } = runTokenizer(
      'a'.codePointAt(0) ?? null,
      types.characterEscape,
      [codes.equalsTo, codes.equalsTo, '_'.codePointAt(0)!],
    )

    expect(token._open).toBe(false)
    expect(token._close).toBe(true)
    expect(result).toEqual({ status: 'ok', code: '_'.codePointAt(0) })
  })

  it('rejects repeated markers, escaped-less repeated starts, and too-short sequences', () => {
    const repeatedStart = runTokenizer(
      codes.equalsTo,
      types.data,
      [codes.equalsTo],
    )
    expect(repeatedStart.result).toEqual({ status: 'nok', code: codes.equalsTo })

    const tooShort = runTokenizer(null, types.data, [
      codes.equalsTo,
      'a'.codePointAt(0)!,
    ])
    expect(tooShort.result).toEqual({ status: 'nok', code: 'a'.codePointAt(0) })

    const tooLong = runTokenizer(
      null,
      types.data,
      [codes.equalsTo, codes.equalsTo, codes.equalsTo],
    )
    expect(tooLong.result).toEqual({ status: 'nok', code: codes.equalsTo })
  })

  it('resolves matching temporary sequences into a generic tag span and preserves inner events', () => {
    const tokenizer = createTokenizer()
    const openEnter = createEvent('markSequenceTemporary', 0, 2)
    const openExit = ['exit', { ...openEnter[1], _open: true }, {}] as any
    const innerEnter = createEvent('chunkText', 2, 4)
    const innerExit = ['exit', innerEnter[1], {}] as any
    const closeEnter = ['enter', { ...openEnter[1], start: { offset: 4 }, end: { offset: 6 }, _close: true }, {}] as any
    const closeExit = ['exit', closeEnter[1], {}] as any
    const context = { parser: { constructs: { insideSpan: { null: [] } } } } as any

    const events = tokenizer.resolveAll(
      [openEnter, openExit, innerEnter, innerExit, closeEnter, closeExit],
      context,
    )

    expect(events.map((event: any) => [event[0], event[1].type])).toEqual([
      ['enter', 'mark'],
      ['enter', 'markSequence'],
      ['exit', 'markSequence'],
      ['enter', 'markText'],
      ['enter', 'chunkText'],
      ['exit', 'chunkText'],
      ['exit', 'markText'],
      ['enter', 'markSequence'],
      ['exit', 'markSequence'],
      ['exit', 'mark'],
    ])
  })

  it('downgrades unmatched temporary sequences back to plain data', () => {
    const tokenizer = createTokenizer()
    const openEnter = createEvent('markSequenceTemporary', 0, 2)
    const openExit = ['exit', { ...openEnter[1], _open: true }, {}] as any
    const closeEnter = ['enter', { ...openEnter[1], start: { offset: 4 }, end: { offset: 7 }, _close: true }, {}] as any
    const closeExit = ['exit', closeEnter[1], {}] as any
    const context = {
      parser: { constructs: { insideSpan: { null: undefined } } },
    } as any

    const events = tokenizer.resolveAll(
      [openEnter, openExit, closeEnter, closeExit],
      context,
    )

    expect(events.every((event: any) => event[1].type === types.data)).toBe(true)
  })
})
