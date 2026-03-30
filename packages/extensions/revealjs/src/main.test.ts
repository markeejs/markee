import { beforeEach, describe, expect, it, vi } from 'vitest'

const { initialize, loadRevealStyles, RevealJS, revealModuleLoads } =
  vi.hoisted(() => {
    const initialize = vi.fn()
    const loadRevealStyles = vi.fn(async () => {})
    const RevealJS = vi.fn(function (
      this: { initialize: typeof initialize },
      element: HTMLElement,
      config: Record<string, unknown>,
    ) {
      this.initialize = initialize
      ;(this as any).element = element
      ;(this as any).config = config
    })

    return {
      initialize,
      loadRevealStyles,
      RevealJS,
      revealModuleLoads: { count: 0 },
    }
  })

vi.mock('reveal.js', () => {
  revealModuleLoads.count += 1
  return {
    default: RevealJS,
  }
})
vi.mock('./styles.js', () => ({
  loadRevealStyles,
}))

async function importMain() {
  vi.resetModules()
  await import('./main.js')
}

async function waitForRevealMount() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mockRect(element: Element, width: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {
      return {}
    },
  })
}

describe('@markee/revealjs', () => {
  beforeEach(() => {
    RevealJS.mockClear()
    initialize.mockClear()
    loadRevealStyles.mockClear()
    revealModuleLoads.count = 0
    document.body.replaceChildren()
  })

  it('loads reveal styles and the reveal bundle only when the first element mounts', async () => {
    let resolveStyles = () => {}
    const stylesLoaded = new Promise<void>((resolve) => {
      resolveStyles = resolve
    })
    loadRevealStyles.mockImplementationOnce(async () => {
      await stylesLoaded
    })

    await importMain()

    expect(loadRevealStyles).not.toHaveBeenCalled()
    expect(revealModuleLoads.count).toBe(0)

    const first = document.createElement('reveal-js')
    first.innerHTML = '<reveal-slide>Slide 1</reveal-slide>'
    mockRect(first, 400, 300)

    document.body.append(first)
    await waitForRevealMount()

    expect(loadRevealStyles).toHaveBeenCalledTimes(1)
    expect(revealModuleLoads.count).toBe(1)
    expect(RevealJS).not.toHaveBeenCalled()

    first.remove()
    resolveStyles()
    await waitForRevealMount()

    expect(RevealJS).not.toHaveBeenCalled()

    const second = document.createElement('reveal-js')
    second.innerHTML = '<reveal-slide>Slide 2</reveal-slide>'
    mockRect(second, 500, 320)

    document.body.append(second)
    await waitForRevealMount()

    expect(loadRevealStyles).toHaveBeenCalledTimes(1)
    expect(revealModuleLoads.count).toBe(1)
  })

  it('defines the custom element and initializes RevealJS with parsed config', async () => {
    await importMain()

    const element = document.createElement('reveal-js')
    element.dataset.config = JSON.stringify({ loop: true })
    element.innerHTML = '<reveal-slide>Slide 1</reveal-slide>'
    mockRect(element, 640, 360)

    document.body.append(element)
    await waitForRevealMount()

    expect(element.classList.contains('reveal')).toBe(true)
    expect(element.classList.contains('no-layout')).toBe(false)
    expect(element.children).toHaveLength(1)
    expect(element.firstElementChild?.classList.contains('slides')).toBe(true)
    expect(element.querySelector('section')?.textContent).toBe('Slide 1')
    expect(RevealJS).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        embedded: true,
        disableLayout: false,
        keyboardCondition: 'focused',
        width: 640,
        height: 360,
        loop: true,
      }),
    )
    expect(initialize).toHaveBeenCalledTimes(1)
  })

  it('falls back to default config and disables layout for raw mode when config is invalid', async () => {
    await importMain()

    const element = document.createElement('reveal-js')
    element.dataset.config = '{'
    element.dataset.layout = 'raw'
    element.innerHTML = '<reveal-slide>Slide 2</reveal-slide>'
    mockRect(element, 800, 600)

    document.body.append(element)
    await waitForRevealMount()

    expect(element.classList.contains('no-layout')).toBe(true)
    expect(RevealJS).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        embedded: true,
        disableLayout: true,
        keyboardCondition: 'focused',
        width: 800,
        height: 600,
      }),
    )
    expect(initialize).toHaveBeenCalledTimes(1)
  })

  it('uses an empty config object when no config dataset is provided', async () => {
    await importMain()

    const element = document.createElement('reveal-js')
    element.innerHTML = '<reveal-slide>Slide 3</reveal-slide>'
    mockRect(element, 320, 200)

    document.body.append(element)
    await waitForRevealMount()

    expect(RevealJS).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        embedded: true,
        disableLayout: false,
        keyboardCondition: 'focused',
        width: 320,
        height: 200,
      }),
    )
    expect(initialize).toHaveBeenCalledTimes(1)
  })
})
