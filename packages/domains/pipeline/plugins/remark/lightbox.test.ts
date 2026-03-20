import { describe, expect, it } from 'vitest'

import { remarkLightbox } from './lightbox.js'

function runLightbox(
  tree: unknown,
  pluginValue: boolean | { enabled: boolean } | undefined = undefined,
) {
  const processor = {
    data: (() =>
      ({
        pluginConfig: () => pluginValue,
      }) as any) as any,
  } as any
  const transform = remarkLightbox.call(processor) as any

  transform(tree)
}

describe('remarkLightbox', () => {
  it('wraps images in a glightbox link by default', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: '/hero.png',
              alt: 'Hero',
              data: { hProperties: {} },
            },
          ],
        },
      ],
    } as const

    runLightbox(tree)

    expect(tree.children[0].children[0]).toEqual({
      type: 'link',
      url: '/hero.png',
      children: [
        {
          type: 'image',
          url: '/hero.png',
          alt: 'Hero',
          data: { hProperties: {} },
        },
      ],
      data: {
        hProperties: {
          class: 'glightbox',
        },
      },
    })
  })

  it('does not wrap linked images or images with disabling classes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'link',
          url: '/hero.png',
          children: [
            {
              type: 'image',
              url: '/hero.png',
              alt: 'Hero',
              data: { hProperties: {} },
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: '/skip.png',
              alt: 'Skip',
              data: {
                hProperties: {
                  class: 'alpha off-glb',
                  className: ['beta'],
                },
              },
            },
          ],
        },
      ],
    } as const

    runLightbox(tree)

    expect(tree.children[0].children[0]).toMatchObject({
      type: 'image',
      url: '/hero.png',
    })
    expect(tree.children[1].children[0]).toMatchObject({
      type: 'image',
      url: '/skip.png',
    })
  })

  it('honors disabled and force-enabled plugin settings', () => {
    const disabledTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: '/plain.png',
              alt: 'Plain',
              data: { hProperties: {} },
            },
            {
              type: 'image',
              url: '/forced.png',
              alt: 'Forced',
              data: {
                hProperties: {
                  className: ['force-lightbox'],
                },
              },
            },
          ],
        },
      ],
    } as const

    runLightbox(disabledTree, { enabled: false })

    expect(disabledTree.children[0].children[0]).toMatchObject({
      type: 'image',
      url: '/plain.png',
    })
    expect(disabledTree.children[0].children[1]).toMatchObject({
      type: 'link',
      url: '/forced.png',
    })

    const enabledTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: '/plain.png',
              alt: 'Plain',
              data: { hProperties: {} },
            },
          ],
        },
      ],
    } as const

    runLightbox(enabledTree, true)

    expect(enabledTree.children[0].children[0]).toMatchObject({
      type: 'link',
      url: '/plain.png',
    })
  })
})
