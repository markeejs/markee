import { describe, expect, it, vi } from 'vitest'

const developmentState = vi.hoisted(() => ({
  loadHead: vi.fn(async () => {}),
  loadRedefineCustomElements: vi.fn(async () => {}),
  mainImported: false,
}))

vi.mock('./load-redefine-custom-elements.js', () => ({
  loadRedefineCustomElements: developmentState.loadRedefineCustomElements,
}))

vi.mock('./listeners/hot-reload.js', () => ({
  loadHead: developmentState.loadHead,
}))

vi.mock('./main.js', () => {
  developmentState.mainImported = true
  return {}
})

let tagId = 0

function createTagName() {
  tagId += 1
  return `markee-client-development-${tagId}`
}

describe('development', () => {
  it('loads hot reload and main, then replaces pre-existing matching elements on define', async () => {
    vi.resetModules()
    developmentState.mainImported = false
    developmentState.loadHead.mockClear()
    developmentState.loadRedefineCustomElements.mockClear()

    await import('./development.js')

    expect(developmentState.loadRedefineCustomElements).toHaveBeenCalledTimes(1)
    expect(developmentState.loadHead).toHaveBeenCalledTimes(1)
    expect(developmentState.mainImported).toBe(true)

    const clone = document.createElement('div')
    clone.innerHTML = 'stale'
    ;(clone as HTMLElement & { requestUpdate?: () => void }).requestUpdate =
      () => {}

    const fakeNode = {
      cloneNode: vi.fn(() => clone),
      replaceWith: vi.fn(),
    }

    const querySelectorAll = vi
      .spyOn(document, 'querySelectorAll')
      .mockReturnValue([fakeNode] as any)

    class TestElement extends HTMLElement {}

    const tagName = createTagName()
    customElements.define(tagName, TestElement)

    expect(querySelectorAll).toHaveBeenCalledWith(tagName)
    expect(fakeNode.cloneNode).toHaveBeenCalledWith(true)
    expect(fakeNode.replaceWith).toHaveBeenCalledWith(clone)
    expect(clone.innerHTML).toBe('')
  })

  it('leaves already-upgraded elements untouched', async () => {
    vi.resetModules()
    developmentState.loadRedefineCustomElements.mockClear()
    await import('./development.js')

    expect(developmentState.loadRedefineCustomElements).toHaveBeenCalledTimes(1)

    class TestElement extends HTMLElement {}

    const querySelectorAll = vi
      .spyOn(document, 'querySelectorAll')
      .mockReturnValue([Object.create(TestElement.prototype)] as any)

    customElements.define(createTagName(), TestElement)

    expect(querySelectorAll).toHaveBeenCalled()
  })
})
