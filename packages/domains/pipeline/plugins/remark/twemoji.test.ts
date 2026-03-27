import { describe, expect, it, vi } from 'vitest'

vi.mock('@discordapp/twemoji', () => ({
  default: {
    parse: vi.fn((value: string) => {
      if (value === 'Hello 🙂') {
        return 'Hello <img class="mk-twemoji" alt="🙂" src="/emoji/smile.png">'
      }
      if (value === 'Broken') {
        return '<img class="mk-twemoji" src="/emoji/broken.png">'
      }
      return value
    }),
  },
}))

import { remarkTwemoji } from './twemoji.js'

describe('remarkTwemoji', () => {
  it('replaces emoji html fragments with image nodes and preserves surrounding text', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Hello 🙂' }],
        },
      ],
    }

    const transform = remarkTwemoji() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Hello ' },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: '🙂',
              data: { twemoji: true, hName: 'span' },
            },
          ],
          data: {
            hName: 'img',
            hProperties: {
              type: 'image/png',
              alt: '🙂',
              src: '/emoji/smile.png',
              draggable: false,
              className: ['mk-twemoji', 'skip-lightbox'],
              onerror: 'this.classList.toggle("mk-twemoji-failed", true)',
              width: '18',
              height: '18',
            },
          },
        },
        { type: 'text', value: '' },
      ],
    })
  })

  it('skips already converted nodes, handles missing alt text, and leaves unmatched text alone', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'unchanged' },
            { type: 'text', value: 'Broken' },
            { type: 'text', value: '🙂', data: { twemoji: true } },
          ],
        },
      ],
    }

    const transform = remarkTwemoji() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'unchanged' },
        { type: 'text', value: '' },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: '',
              data: { twemoji: true, hName: 'span' },
            },
          ],
          data: {
            hName: 'img',
            hProperties: {
              type: 'image/png',
              alt: undefined,
              src: '/emoji/broken.png',
              draggable: false,
              className: ['mk-twemoji', 'skip-lightbox'],
              onerror: 'this.classList.toggle("mk-twemoji-failed", true)',
              width: '18',
              height: '18',
            },
          },
        },
        { type: 'text', value: '' },
        { type: 'text', value: '🙂', data: { twemoji: true } },
      ],
    })
  })

  it('normalizes :flag_xx: tokens before emoji replacement', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Flag :flag_ca: and :flag_us:.' }],
        },
      ],
    }

    const transform = remarkTwemoji.flagSupport() as any
    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Flag :ca: and :us:.' }],
    })
  })
})
