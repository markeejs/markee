import { describe, expect, it, vi } from 'vitest'

async function importMain() {
  vi.resetModules()

  const create = vi.fn((_src: string | null, element: HTMLElement) => {
    element.innerHTML = '<div class="ap-wrapper"></div>'
  })
  const remark = vi.fn()
  const visit = vi.fn(
    (tree: any, _type: string, callback: (node: any) => void) => {
      tree.children.forEach((node: any) => callback(node))
    },
  )

  vi.doMock('asciinema-player', () => ({
    create,
  }))
  vi.doMock('@markee/runtime', () => ({
    extend: {
      markdownPipeline: {
        remark,
        visit,
      },
    },
  }))

  await import('./main.js')

  return { create, remark, visit }
}

describe('@markee/asciinema', () => {
  it('defines the player element and initializes asciinema-player on connect', async () => {
    const { create } = await importMain()
    const element = document.createElement('asciinema-player')
    element.setAttribute('src', '/demo.cast')
    element.setAttribute('width', '720px')

    document.body.append(element)

    expect(create).toHaveBeenCalledWith('/demo.cast', element, {
      preload: true,
    })
    expect(
      element.querySelector<HTMLDivElement>('.ap-wrapper')?.style.maxWidth,
    ).toBe('720px')
  })

  it('registers a remark plugin that rewrites cast images only', async () => {
    const { remark } = await importMain()

    expect(remark).toHaveBeenCalledWith('asciinema', expect.any(Function))

    const plugin = remark.mock.calls[0]?.[1] as Function
    const castImage = { type: 'image', url: '/demo.cast' }
    const pngImage = { type: 'image', url: '/demo.png' }
    const tree = { children: [castImage, pngImage] }

    plugin()(tree)

    expect(castImage).toMatchObject({
      type: 'element',
      data: {
        hName: 'asciinema-player',
        hProperties: {
          src: '/demo.cast',
        },
      },
    })
    expect(pngImage).toEqual({ type: 'image', url: '/demo.png' })
  })
})
