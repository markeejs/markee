import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarkeeTabs } from './markee-tabs'

afterEach(() => {
  MarkeeTabs.treating = false
  vi.restoreAllMocks()
})

describe('markee-tabs', () => {
  it('clicks linked tabs for initially checked inputs on connect', () => {
    const element = new MarkeeTabs()
    const checked = document.createElement('input')
    checked.className = 'mk-tabbed-input'
    checked.dataset.tab = 'alpha'
    checked.checked = true

    const linkedA = document.createElement('input')
    linkedA.dataset.tab = 'alpha'
    linkedA.click = vi.fn()

    const linkedB = document.createElement('input')
    linkedB.dataset.tab = 'alpha'
    linkedB.click = vi.fn()

    element.append(checked)
    document.body.append(element, linkedA, linkedB)

    expect(linkedA.click).toHaveBeenCalledOnce()
    expect(linkedB.click).toHaveBeenCalledOnce()
    expect(MarkeeTabs.treating).toBe(false)
  })

  it('syncs linked tabs on change events and ignores re-entrant updates', () => {
    const element = new MarkeeTabs()
    const input = document.createElement('input')
    input.className = 'mk-tabbed-input'
    input.dataset.tab = 'beta'

    const linked = document.createElement('input')
    linked.dataset.tab = 'beta'
    linked.click = vi.fn()

    element.append(input)
    document.body.append(element, linked)

    input.dispatchEvent(new Event('change'))

    expect(linked.click).toHaveBeenCalledOnce()
    expect(MarkeeTabs.treating).toBe(false)

    MarkeeTabs.treating = true
    input.dispatchEvent(new Event('change'))

    expect(linked.click).toHaveBeenCalledOnce()
  })
})
