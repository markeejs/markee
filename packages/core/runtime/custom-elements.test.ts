import { describe, expect, it, vi } from 'vitest'

const customElementsState = vi.hoisted(() => ({
  withStores: vi.fn(
    (BaseClass: typeof HTMLElement) => class extends BaseClass {},
  ),
}))

vi.mock('@nanostores/lit', () => ({
  withStores: customElementsState.withStores,
}))

import { BooleanConverter, MarkeeElement } from './custom-elements.js'

let tagId = 0

function createTagName(prefix: string) {
  tagId += 1
  return `markee-runtime-${prefix}-${tagId}`
}

describe('custom-elements', () => {
  it('converts boolean-like attribute values', () => {
    expect(BooleanConverter('false')).toBe(false)
    expect(BooleanConverter('')).toBe(true)
    expect(BooleanConverter(null)).toBe(false)
  })

  it('defines elements through tag(), sets role through with(), and renders in light dom', () => {
    class TestElement extends MarkeeElement {}

    const EnhancedElement = TestElement.with({ role: 'dialog' })
    const tagName = createTagName('role')

    EnhancedElement.tag(tagName)

    const element = new EnhancedElement() as InstanceType<
      typeof EnhancedElement
    >

    expect(customElements.get(tagName)).toBe(EnhancedElement)
    expect(element.getAttribute('role')).toBe('dialog')
    expect(element.createRenderRoot()).toBe(element)
  })

  it('delegates to withStores when stores are provided and leaves role unset otherwise', () => {
    class TestElement extends MarkeeElement {}

    const stores = [
      {
        get() {},
        subscribe() {
          return () => {}
        },
      },
    ] as any
    const EnhancedElement = TestElement.with({ stores })
    const tagName = createTagName('stores')

    EnhancedElement.tag(tagName)

    const element = new EnhancedElement()

    expect(customElementsState.withStores).toHaveBeenCalledWith(
      TestElement,
      stores,
    )
    expect(element.getAttribute('role')).toBeNull()
    expect(element).toBeInstanceOf(TestElement)
  })
})
