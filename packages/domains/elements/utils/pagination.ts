import { nothing } from 'lit'

type PaginationInput<T> = {
  elements: readonly T[]
  pageSize: number
  page: number
  onPageChange: (page: number) => void
}

type PaginationOutput<T> = {
  slice: T[]
  totalPages: number
  pageButtons: number[]
  openNextPage: null | (() => void)
  openPreviousPage: null | (() => void)
  openPage: (page: number) => void
}

function toSafeInt(n: number): number {
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function range(start: number, end: number) {
  const length = end - start + 1
  return Array.from({ length }, (_, index) => index + start)
}

function buildPageButtons(totalPages: number, currentPage: number): number[] {
  const siblings = 1
  const boundaries = 1
  const totalPageNumbers = siblings * 2 + 3 + boundaries * 2
  if (totalPageNumbers >= totalPages) {
    return range(1, totalPages)
  }

  const leftSiblingIndex = Math.max(currentPage - siblings, boundaries)
  const rightSiblingIndex = Math.min(
    currentPage + siblings,
    totalPages - boundaries,
  )

  const shouldShowLeftDots = leftSiblingIndex > boundaries + 2
  const shouldShowRightDots = rightSiblingIndex < totalPages - (boundaries + 1)

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = siblings * 2 + boundaries + 2
    return [
      ...range(1, leftItemCount),
      0,
      ...range(totalPages - (boundaries - 1), totalPages),
    ]
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = boundaries + 1 + 2 * siblings
    return [
      ...range(1, boundaries),
      0,
      ...range(totalPages - rightItemCount, totalPages),
    ]
  }

  return [
    ...range(1, boundaries),
    0,
    ...range(leftSiblingIndex, rightSiblingIndex),
    0,
    ...range(totalPages - boundaries + 1, totalPages),
  ]
}

export function getPageLink(page: number, disabled: boolean) {
  if (disabled) return nothing
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.set('page', `${page}`)
  return '?' + searchParams.toString()
}

export function getPagination<T>(
  input: PaginationInput<T>,
): PaginationOutput<T> {
  const elements = input.elements ?? []
  const pageSize = Math.max(1, toSafeInt(input.pageSize))
  const totalPages = Math.ceil(elements.length / pageSize)

  const minPage = 1
  const maxPage = totalPages > 0 ? totalPages : 1

  const currentPage = clamp(toSafeInt(input.page), minPage, maxPage)

  const pageIndex = currentPage - 1
  const start = pageIndex * pageSize
  const end = start + pageSize
  const slice = elements.slice(start, end)

  const openPage = (page: number) => {
    const next = clamp(toSafeInt(page), minPage, maxPage)
    input.onPageChange(next)
    history.pushState({}, '', getPageLink(next, false) as string)
    window.scrollTo(0, 0)
  }

  const hasNext = totalPages > 0 && currentPage < totalPages
  const hasPrev = totalPages > 0 && currentPage > 1

  return {
    slice,
    totalPages,
    pageButtons: buildPageButtons(totalPages, currentPage),
    openNextPage: hasNext ? () => openPage(currentPage + 1) : null,
    openPreviousPage: hasPrev ? () => openPage(currentPage - 1) : null,
    openPage,
  }
}
