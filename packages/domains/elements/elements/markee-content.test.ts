import { beforeEach, describe, expect, it, vi } from 'vitest'

import { state } from '@markee/state'
import { MarkeeContent } from './markee-content'

describe('markee-content', () => {
  let onLoad: ((data: any) => void) | undefined
  let unsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onLoad = undefined
    unsubscribe = vi.fn()
    history.replaceState({}, '', '/')

    vi.restoreAllMocks()
    vi.spyOn(state.$currentLoader, 'subscribe').mockImplementation(((
      listener: (data: any) => void,
    ) => {
      onLoad = listener
      return unsubscribe
    }) as typeof state.$currentLoader.subscribe)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((
      callback: FrameRequestCallback,
    ) => {
      callback(0)
      return 1
    }) as typeof requestAnimationFrame)
  })

  function connectContent() {
    const content = new MarkeeContent()
    document.body.append(content)

    expect(onLoad).toBeTypeOf('function')

    return content
  }

  it('renders incoming content from the current loader payload', () => {
    const content = connectContent()

    onLoad?.({
      data: {
        key: 'docs/current.md',
        content: '<h3 id="target">Target</h3><p>Body</p>',
      },
    })

    expect(content.children).toHaveLength(2)
    expect(content.querySelector('h3')?.textContent).toBe('Target')
    expect(content.querySelector('p')?.textContent).toBe('Body')
  })

  it('injects custom heading anchors and keeps existing ones untouched', () => {
    const content = connectContent()
    content.dataset.headingAnchors = '<span>#</span>'

    onLoad?.({
      data: {
        key: 'docs/current.md',
        content: `
          <h3 id="target">Target</h3>
          <h4 id="kept">Kept <a data-heading="true" href="#kept">#</a></h4>
        `,
      },
    })

    const headers = content.querySelectorAll(':scope > :is(h3,h4,h5,h6)')
    const injectedAnchor = headers[0]?.querySelector('[data-heading="true"]')
    const keptAnchors = headers[1]?.querySelectorAll('[data-heading="true"]')

    expect(headers).toHaveLength(2)
    expect(injectedAnchor?.getAttribute('href')).toBe('#target')
    expect(injectedAnchor?.innerHTML).toBe('<span>#</span>')
    expect(keptAnchors).toHaveLength(1)
  })

  it('uses the default heading anchor when the dataset value is empty', () => {
    const content = connectContent()
    content.dataset.headingAnchors = ''

    onLoad?.({
      data: {
        key: 'docs/one.md',
        content: '<h3 id="first">First</h3>',
      },
    })

    expect(content.querySelector('[data-heading="true"]')?.innerHTML).toBe(
      '<i class="fa-solid fa-link"></i>',
    )
  })

  it('refreshes other elements but skips the current markee-content instance', () => {
    const content = connectContent() as MarkeeContent & {
      refresh: ReturnType<typeof vi.fn>
      requestUpdate: ReturnType<typeof vi.fn>
    }
    content.refresh = vi.fn()
    content.requestUpdate = vi.fn()

    const sibling = document.createElement('section') as HTMLElement & {
      refresh: ReturnType<typeof vi.fn>
      requestUpdate: ReturnType<typeof vi.fn>
    }
    sibling.refresh = vi.fn()
    sibling.requestUpdate = vi.fn()

    document.body.append(sibling)

    onLoad?.({
      data: {
        key: 'docs/current.md',
        content: '<p>Body</p>',
      },
    })

    expect(sibling.refresh).toHaveBeenCalledOnce()
    expect(sibling.requestUpdate).toHaveBeenCalledOnce()
    expect(content.refresh).not.toHaveBeenCalled()
    expect(content.requestUpdate).not.toHaveBeenCalled()
  })

  it('scrolls to the hash target after rendering new content', () => {
    history.replaceState({}, '', '/docs/current#target')

    const content = connectContent()
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})

    onLoad?.({
      data: {
        key: 'docs/current.md',
        content: '<h3 id="target">Target</h3>',
      },
    })

    expect(content.querySelector('#target')).not.toBeNull()
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('scrolls to the top when the location hash is empty', () => {
    connectContent()

    onLoad?.({
      data: {
        key: 'docs/one.md',
        content: '<h3 id="first">First</h3>',
      },
    })

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('avoids duplicate scroll scheduling until the hash or key changes', () => {
    connectContent()
    const raf = vi.mocked(requestAnimationFrame)

    onLoad?.({
      data: {
        key: 'docs/one.md',
        content: '<h3 id="first">First</h3>',
      },
    })

    expect(raf).toHaveBeenCalledTimes(1)

    onLoad?.({
      data: {
        key: 'docs/one.md',
        content: '<h3 id="first">First</h3>',
      },
    })

    expect(raf).toHaveBeenCalledTimes(1)

    history.replaceState({}, '', '/docs/one#second')
    onLoad?.({
      data: {
        key: 'docs/two.md',
        content: '<h3 id="second">Second</h3>',
      },
    })

    expect(raf).toHaveBeenCalledTimes(2)
  })

  it('swallows selector errors and missing hash targets when resolving a hash', () => {
    history.replaceState({}, '', '/docs/current#missing')

    const content = new MarkeeContent()
    document.body.append(content)

    expect(onLoad).toBeTypeOf('function')

    const querySelector = vi.spyOn(document, 'querySelector')

    querySelector.mockReturnValueOnce(null)

    expect(() =>
      onLoad?.({
        data: {
          key: 'docs/current.md',
          content: '<p>Body</p>',
        },
      }),
    ).not.toThrow()

    querySelector.mockImplementationOnce(() => {
      throw new Error('invalid selector')
    })

    expect(() =>
      onLoad?.({
        data: {
          key: 'docs/next.md',
          content: '<p>Body</p>',
        },
      }),
    ).not.toThrow()
  })

  it('unsubscribes on disconnect and tolerates disconnects before connection', () => {
    expect(() => {
      new MarkeeContent().disconnectedCallback()
    }).not.toThrow()

    const content = new MarkeeContent()
    document.body.append(content)

    content.disconnectedCallback()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
