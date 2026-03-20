import { describe, expect, it, vi } from 'vitest'

import { mdastGenericTag } from './mdast.js'

describe('mdastGenericTag', () => {
  it('exposes from-markdown handlers for the configured generic tag', () => {
    const extension = mdastGenericTag({ name: 'mark', character: '=' })
    const fromMarkdown = extension.genericTagFromMarkdown()
    const enter = vi.fn()
    const exit = vi.fn()
    const token = { type: 'markSequence' }

    fromMarkdown.enter!.mark!.call({ enter } as any, token as any)
    fromMarkdown.exit!.mark!.call({ exit } as any, token as any)

    expect(fromMarkdown.canContainEols).toEqual(['mark'])
    expect(enter).toHaveBeenCalledWith(
      {
        type: 'mark',
        children: [],
        data: { hName: 'mark' },
      },
      token,
    )
    expect(exit).toHaveBeenCalledWith(token)
  })

  it('exposes the corresponding to-markdown unsafe marker configuration', () => {
    const extension = mdastGenericTag({ name: 'ins', character: '+' })

    expect(extension.genericTagToMarkdown()).toEqual({
      unsafe: [
        {
          character: '+',
          inConstruct: 'phrasing',
          notInConstruct: [
            'autolink',
            'destinationLiteral',
            'destinationRaw',
            'reference',
            'titleQuote',
            'titleApostrophe',
          ],
        },
      ],
    })
  })
})
