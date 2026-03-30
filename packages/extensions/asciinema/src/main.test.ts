import { beforeEach, describe, expect, it, vi } from 'vitest'

const { create, loadAsciinemaStyles, playerModuleLoads } = vi.hoisted(() => ({
  create: vi.fn((_src: string | null, element: HTMLElement) => {
    element.innerHTML = '<div class="ap-wrapper"></div>'
  }),
  loadAsciinemaStyles: vi.fn(async () => {}),
  playerModuleLoads: { count: 0 },
}))

async function importMain() {
  vi.resetModules()

  const remark = vi.fn()
  const visit = vi.fn(
    (tree: any, _type: string, callback: (node: any) => void) => {
      tree.children.forEach((node: any) => callback(node))
    },
  )

  vi.doMock('asciinema-player', () => {
    playerModuleLoads.count += 1

    return {
      create,
    }
  })
  vi.doMock('./styles.js', () => ({
    loadAsciinemaStyles,
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

async function waitForAsciinemaMount() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('@markee/asciinema', () => {
  beforeEach(() => {
    create.mockClear()
    loadAsciinemaStyles.mockClear()
    playerModuleLoads.count = 0
    document.body.replaceChildren()
  })

  it('loads asciinema styles and the player bundle only when the first element mounts', async () => {
    let resolveStyles = () => {}
    const stylesLoaded = new Promise<void>((resolve) => {
      resolveStyles = resolve
    })
    loadAsciinemaStyles.mockImplementationOnce(async () => {
      await stylesLoaded
    })

    await importMain()

    expect(loadAsciinemaStyles).not.toHaveBeenCalled()
    expect(playerModuleLoads.count).toBe(0)

    const first = document.createElement('asciinema-player')
    first.setAttribute('src', '/first.cast')

    document.body.append(first)
    await waitForAsciinemaMount()

    expect(loadAsciinemaStyles).toHaveBeenCalledTimes(1)
    expect(playerModuleLoads.count).toBe(1)
    expect(create).not.toHaveBeenCalled()

    first.remove()
    resolveStyles()
    await waitForAsciinemaMount()

    expect(create).not.toHaveBeenCalled()

    const second = document.createElement('asciinema-player')
    second.setAttribute('src', '/second.cast')

    document.body.append(second)
    await waitForAsciinemaMount()

    expect(loadAsciinemaStyles).toHaveBeenCalledTimes(1)
    expect(playerModuleLoads.count).toBe(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith('/second.cast', second, {
      preload: true,
    })
  })

  it('defines the player element and initializes asciinema-player on connect', async () => {
    const { create } = await importMain()
    const element = document.createElement('asciinema-player')
    element.setAttribute('src', '/demo.cast')
    element.setAttribute('width', '720px')

    document.body.append(element)
    await waitForAsciinemaMount()

    expect(create).toHaveBeenCalledWith('/demo.cast', element, {
      preload: true,
    })
    expect(
      element.querySelector<HTMLDivElement>('.ap-wrapper')?.style.maxWidth,
    ).toBe('720px')
  })

  it('does not redefine the custom element and allows mounts without width', async () => {
    await importMain()
    await expect(importMain()).resolves.toBeDefined()

    const element = document.createElement('asciinema-player')
    element.setAttribute('src', '/demo.cast')

    document.body.append(element)
    await waitForAsciinemaMount()

    expect(create).toHaveBeenCalledWith('/demo.cast', element, {
      preload: true,
    })
    expect(
      element.querySelector<HTMLDivElement>('.ap-wrapper')?.style.maxWidth,
    ).toBe('')
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
