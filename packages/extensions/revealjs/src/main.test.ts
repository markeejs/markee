import { beforeEach, describe, expect, it, vi } from 'vitest'

const { initialize, RevealJS } = vi.hoisted(() => {
  const initialize = vi.fn()
  const RevealJS = vi.fn(function (
    this: { initialize: typeof initialize },
    element: HTMLElement,
    config: Record<string, unknown>,
  ) {
    this.initialize = initialize
    ;(this as any).element = element
    ;(this as any).config = config
  })

  return { initialize, RevealJS }
})

vi.mock('reveal.js', () => ({
  default: RevealJS,
}))

await import('./main.js')

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
  })

  it('defines the custom element and initializes RevealJS with parsed config', () => {
    const element = document.createElement('reveal-js')
    element.dataset.config = JSON.stringify({ loop: true })
    element.innerHTML = '<reveal-slide>Slide 1</reveal-slide>'
    mockRect(element, 640, 360)

    document.body.append(element)

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

  it('falls back to default config and disables layout for raw mode when config is invalid', () => {
    const element = document.createElement('reveal-js')
    element.dataset.config = '{'
    element.dataset.layout = 'raw'
    element.innerHTML = '<reveal-slide>Slide 2</reveal-slide>'
    mockRect(element, 800, 600)

    document.body.append(element)

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

  it('uses an empty config object when no config dataset is provided', () => {
    const element = document.createElement('reveal-js')
    element.innerHTML = '<reveal-slide>Slide 3</reveal-slide>'
    mockRect(element, 320, 200)

    document.body.append(element)

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
