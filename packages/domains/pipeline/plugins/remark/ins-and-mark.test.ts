import { beforeEach, describe, expect, it, vi } from 'vitest'

const genericTagState = vi.hoisted(() => ({
  mdastCalls: [] as Array<{ name: string; character: string }>,
  micromarkCalls: [] as Array<{ name: string; character: string }>,
}))

vi.mock('./generic-tags/mdast.js', () => ({
  mdastGenericTag(options: { name: string; character: string }) {
    genericTagState.mdastCalls.push(options)

    return {
      genericTagFromMarkdown: () => `${options.name}-from`,
      genericTagToMarkdown: () => `${options.name}-to`,
    }
  },
}))

vi.mock('./generic-tags/micromark.js', () => ({
  micromarkGenericTag(options: { name: string; character: string }) {
    genericTagState.micromarkCalls.push(options)

    return `${options.name}-${options.character}-micromark`
  },
}))

import { remarkInsAndMark } from './ins-and-mark.js'

describe('remarkInsAndMark', () => {
  beforeEach(() => {
    genericTagState.mdastCalls.length = 0
    genericTagState.micromarkCalls.length = 0
  })

  it('initializes missing processor arrays and appends ins/mark extensions', () => {
    const data: Record<string, unknown> = {}

    remarkInsAndMark.call({
      data() {
        return data
      },
    } as any)

    expect(genericTagState.mdastCalls).toEqual([
      { name: 'ins', character: '+' },
      { name: 'mark', character: '=' },
    ])
    expect(genericTagState.micromarkCalls).toEqual([
      { name: 'ins', character: 'plusSign' },
      { name: 'mark', character: 'equalsTo' },
    ])
    expect(data).toEqual({
      micromarkExtensions: [
        'ins-plusSign-micromark',
        'mark-equalsTo-micromark',
      ],
      fromMarkdownExtensions: ['ins-from', 'mark-from'],
      toMarkdownExtensions: ['ins-to', 'mark-to'],
    })
  })

  it('reuses existing processor arrays instead of replacing them', () => {
    const data = {
      micromarkExtensions: ['existing-micromark'],
      fromMarkdownExtensions: ['existing-from'],
      toMarkdownExtensions: ['existing-to'],
    }

    remarkInsAndMark.call({
      data() {
        return data
      },
    } as any)

    expect(data.micromarkExtensions).toEqual([
      'existing-micromark',
      'ins-plusSign-micromark',
      'mark-equalsTo-micromark',
    ])
    expect(data.fromMarkdownExtensions).toEqual([
      'existing-from',
      'ins-from',
      'mark-from',
    ])
    expect(data.toMarkdownExtensions).toEqual([
      'existing-to',
      'ins-to',
      'mark-to',
    ])
  })
})
