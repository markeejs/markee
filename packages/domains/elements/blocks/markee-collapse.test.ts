import { describe, expect, it } from 'vitest'
import type { MarkeeCollapse as IMarkeeCollapse } from './markee-collapse'

const { MarkeeCollapse } = await import('./markee-collapse')

function createCollapse() {
  const element = document.createElement('markee-collapse')
  if (!(element instanceof MarkeeCollapse)) {
    throw new Error('markee-collapse was not created')
  }
  return element
}

function getInner(element: IMarkeeCollapse) {
  const inner = element.firstElementChild
  if (!(inner instanceof HTMLDivElement)) {
    throw new Error('inner wrapper not found')
  }
  return inner
}

describe('markee-collapse', () => {
  it('wraps the initial light-dom nodes once, preserving node identity and order', () => {
    const element = createCollapse()
    const leadingText = document.createTextNode('Alpha ')
    const strong = document.createElement('strong')
    const trailingText = document.createTextNode(' Beta')

    strong.textContent = 'Gamma'
    element.append(leadingText, strong, trailingText)

    document.body.append(element)

    const inner = getInner(element)

    expect(Array.from(inner.childNodes)).toEqual([
      leadingText,
      strong,
      trailingText,
    ])
    expect(element.childNodes).toHaveLength(1)
    expect(inner.textContent).toBe('Alpha Gamma Beta')
  })

  it('does not rewrap on reconnect and leaves later-added nodes outside the initial wrapper', () => {
    const element = createCollapse()
    const initial = document.createElement('span')
    initial.textContent = 'Initial'
    element.append(initial)

    document.body.append(element)

    const inner = getInner(element)

    document.body.removeChild(element)
    document.body.appendChild(element)

    const later = document.createElement('span')
    later.textContent = 'Later'
    element.append(later)

    expect(getInner(element)).toBe(inner)
    expect(inner.childNodes).toHaveLength(1)
    expect(inner.contains(initial)).toBe(true)
    expect(inner.contains(later)).toBe(false)
    expect(element.lastElementChild).toBe(later)
  })
})
