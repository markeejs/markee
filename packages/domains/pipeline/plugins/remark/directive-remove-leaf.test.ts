import { describe, expect, it } from 'vitest'

import { remarkDirectiveRemoveLeaf } from './directive-remove-leaf.js'

describe('remarkDirectiveRemoveLeaf', () => {
  it('removes the inline text handler from the directive micromark extension', () => {
    const directiveExtension = {
      flow: {
        ['58']: {},
      },
      text: {
        tokenize: 'inline-directive',
      },
    }
    const otherExtension = {
      flow: undefined,
      text: {
        tokenize: 'other',
      },
    }
    const data = {
      micromarkExtensions: [otherExtension, directiveExtension],
    }

    remarkDirectiveRemoveLeaf.call({
      data: () => data,
    })

    expect(directiveExtension).toEqual({
      flow: {
        ['58']: {},
      },
    })
    expect(otherExtension.text).toEqual({
      tokenize: 'other',
    })
  })
})
