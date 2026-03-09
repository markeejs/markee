import { state } from '@markee/state'

export interface TocItem {
  label: string
  id: string
  items: TocItem[]
  passed: boolean
  active: boolean
  current: boolean
}

function convertRemToPixels(rem: number) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}

let forcedHighlight: string | null = location.hash.slice(1) || null
let debounced = true
window.addEventListener('scroll', () => {
  if (debounced) {
    forcedHighlight = null
  }
})
window.addEventListener('hashchange', () => {
  debounced = false
  forcedHighlight = location.hash.slice(1) || forcedHighlight
  window.dispatchEvent(new CustomEvent('scroll'))
  setTimeout(() => (debounced = true), 300)
})
state.$router.subscribe(() => {
  debounced = false
  forcedHighlight = location.hash.slice(1) || forcedHighlight
  window.dispatchEvent(new CustomEvent('scroll'))
  setTimeout(() => (debounced = true), 300)
})

export function getHeaders(
  bottom: boolean,
  depth: 3 | 4 | 5 | 6 = 6,
): TocItem[] {
  const highlightStrategy = forcedHighlight
    ? 'forced'
    : bottom
      ? 'bottom'
      : 'classic'
  const root = document.getElementById('markee-section-main')!

  const headerHeight =
    getComputedStyle(root).getPropertyValue('--mk-header-height')
  let offset = Number.parseInt(headerHeight)
  if (headerHeight.endsWith('rem')) {
    offset = convertRemToPixels(offset)
  }

  let headerSelector = 'h3'
  if (depth > 3) headerSelector += ',h4'
  if (depth > 4) headerSelector += ',h5'
  if (depth > 5) headerSelector += ',h6'

  const headers = [
    ...root.querySelectorAll(`markee-content > :is(${headerSelector})`),
  ]
  const groups = {
    H3: [] as any[],
    H4: [] as any[],
    H5: [] as any[],
    H6: [] as any[],
  }
  const parents = {
    H3: null,
    H4: groups.H3,
    H5: groups.H4,
    H6: groups.H5,
  }
  headers.forEach((item) => {
    const header = {
      label: item.textContent ?? '',
      id: item.id,
      active: false,
      passed:
        highlightStrategy === 'classic'
          ? item.getBoundingClientRect().top < offset + 32
          : false,
      items: [],
      parent: null,
    }
    groups[item.tagName as 'H3'].push(header)
    if (parents[item.tagName as 'H4']) {
      const parent =
        parents[item.tagName as 'H4'][parents[item.tagName as 'H4'].length - 1]
      header.parent = parent
      parent?.items.push(header)
    }
  })

  if (highlightStrategy === 'classic') {
    const applyLogic = (header: any, index: number, array: any[]) => {
      const next = array[index + 1]
      const parentActive = header.parent ? header.parent.active : true
      header.active = parentActive && header.passed && !next?.passed
      header.items?.forEach(applyLogic)
      header.current =
        header.active && !header.items?.some((i: any) => i.active)
    }

    groups.H3.forEach(applyLogic)
  }

  if (highlightStrategy === 'bottom') {
    groups.H3.forEach((h) => (h.passed = true))
    groups.H4.forEach((h) => (h.passed = true))
    groups.H5.forEach((h) => (h.passed = true))
    groups.H6.forEach((h) => (h.passed = true))

    const applyLogic = (header: any, index: number, array: any[]) => {
      header.active = index === array.length - 1
      header.items?.forEach(applyLogic)
      header.current =
        header.active && !header.items?.some((i: any) => i.active)
    }

    if (groups.H3[groups.H3.length - 1]) {
      groups.H3[groups.H3.length - 1].active = true
      groups.H3[groups.H3.length - 1].items?.forEach(applyLogic)
      groups.H3[groups.H3.length - 1].current = !groups.H3[
        groups.H3.length - 1
      ].items?.some((i: any) => i.active)
    }
  }

  if (highlightStrategy === 'forced') {
    let foundSelected = false
    const applySelection = (header: any) => {
      header.active = true
      if (header.parent) applySelection(header.parent)
    }
    const applyLogic = (headers: any[]) => {
      headers.forEach((header) => {
        header.passed = !foundSelected
        if (header.id === forcedHighlight) {
          foundSelected = true
          header.current = true
          applySelection(header)
        }
        applyLogic(header.items)
      })
    }

    applyLogic(groups.H3)
  }

  return groups.H3
}
