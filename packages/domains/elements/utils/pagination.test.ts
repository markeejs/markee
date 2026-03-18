import { afterEach, describe, expect, it, vi } from 'vitest'
import { nothing } from 'lit'

import { getPageLink, getPagination } from './pagination'

afterEach(() => {
  vi.restoreAllMocks()
  history.replaceState({}, '', '/')
})

describe('getPageLink', () => {
  it('returns lit nothing when links are disabled', () => {
    expect(getPageLink(2, true)).toBe(nothing)
  })

  it('builds page links from the current query string', () => {
    history.replaceState({}, '', '/docs?q=test')
    expect(getPageLink(3, false)).toBe('?q=test&page=3')
  })
})

describe('getPagination', () => {
  it('returns the full page list when pagination is small', () => {
    const result = getPagination({
      elements: ['a', 'b', 'c'],
      pageSize: 10,
      page: 1,
      onPageChange() {},
    })

    expect(result.slice).toEqual(['a', 'b', 'c'])
    expect(result.totalPages).toBe(1)
    expect(result.pageButtons).toEqual([1])
    expect(result.openNextPage).toBeNull()
    expect(result.openPreviousPage).toBeNull()
  })

  it('builds page buttons for left, right, and middle ellipsis cases', () => {
    const base = {
      elements: Array.from({ length: 100 }, (_, index) => index + 1),
      pageSize: 10,
      onPageChange() {},
    }

    expect(getPagination({ ...base, page: 2 }).pageButtons).toEqual([
      1, 2, 3, 4, 5, 0, 10,
    ])
    expect(getPagination({ ...base, page: 9 }).pageButtons).toEqual([
      1, 0, 6, 7, 8, 9, 10,
    ])
    expect(getPagination({ ...base, page: 5 }).pageButtons).toEqual([
      1, 0, 4, 5, 6, 0, 10,
    ])
  })

  it('clamps page values and drives navigation side effects', () => {
    const onPageChange = vi.fn()
    const pushStateSpy = vi.spyOn(history, 'pushState')
    const scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)

    const result = getPagination({
      elements: Array.from({ length: 25 }, (_, index) => index + 1),
      pageSize: 5.8,
      page: 999,
      onPageChange,
    })

    expect(result.totalPages).toBe(5)
    expect(result.slice).toEqual([21, 22, 23, 24, 25])
    expect(result.openNextPage).toBeNull()
    expect(result.openPreviousPage).not.toBeNull()

    result.openPreviousPage?.()

    expect(onPageChange).toHaveBeenNthCalledWith(1, 4)
    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '?page=4')
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)

    result.openPage(-10)
    expect(onPageChange).toHaveBeenLastCalledWith(1)
  })

  it('handles empty element lists and non-finite numbers safely', () => {
    const onPageChange = vi.fn()

    const result = getPagination({
      elements: undefined as any,
      pageSize: Number.POSITIVE_INFINITY,
      page: Number.NaN,
      onPageChange,
    })

    expect(result.slice).toEqual([])
    expect(result.totalPages).toBe(0)
    expect(result.pageButtons).toEqual([])
    expect(result.openNextPage).toBeNull()
    expect(result.openPreviousPage).toBeNull()

    result.openPage(7)
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('opens the next page when a next page exists', () => {
    const onPageChange = vi.fn()
    const pushStateSpy = vi.spyOn(history, 'pushState')
    const scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)

    const result = getPagination({
      elements: Array.from({ length: 25 }, (_, index) => index + 1),
      pageSize: 5,
      page: 1,
      onPageChange,
    })

    result.openNextPage?.()

    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '?page=2')
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })
})
