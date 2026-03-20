import { describe, expect, it, vi } from 'vitest'

function createVisit() {
  return vi.fn((tree: any, _type: string, callback: Function) => {
    const walk = (node: any, parent?: any, index?: number) => {
      if (node?.type === 'element') {
        callback(node, index, parent)
      }
      if (Array.isArray(node?.children)) {
        node.children.slice().forEach((child: any, childIndex: number) => {
          walk(child, node, childIndex)
        })
      }
    }
    walk(tree)
  })
}

async function importTooltip() {
  vi.resetModules()

  const rehype = vi.fn()
  const visit = createVisit()

  vi.doMock('@markee/runtime', () => ({
    extend: {
      markdownPipeline: {
        rehype,
        visit,
      },
    },
  }))

  await import('./tooltip.mjs')

  return { rehype, visit }
}

function mockRect(element: Element, rect: Partial<DOMRect>) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON() {
      return {}
    },
    ...rect,
  } as DOMRect)
}

describe('@markee/tooltips', () => {
  it('registers a rehype plugin that wraps titled elements and footnote refs', async () => {
    const { rehype } = await importTooltip()

    expect(rehype).toHaveBeenCalledWith('markee-tooltips', expect.any(Function))

    const transform = rehype.mock.calls[0]?.[1].call({
      data: () => ({
        pluginConfig: (name: string) =>
          name === 'tooltips' ? { footnotes: true } : undefined,
      }),
    })

    const titled = {
      type: 'element',
      tagName: 'a',
      properties: { title: 'Link tip' },
      children: [{ type: 'text', value: 'Hello' }],
    }
    const code = {
      type: 'element',
      tagName: 'code',
      properties: { title: 'Ignore me' },
      children: [],
    }
    const missingNoteRef = {
      type: 'element',
      tagName: 'sup',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { dataFootnoteRef: '', href: '#missing' },
          children: [],
        },
      ],
    }
    const dummyRef = {
      type: 'element',
      tagName: 'sup',
      properties: { dummy: true },
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { dataFootnoteRef: '', href: '#note-1' },
          children: [],
        },
      ],
    }
    const actualRef = {
      type: 'element',
      tagName: 'sup',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { dataFootnoteRef: '', href: '#note-1' },
          children: [],
        },
      ],
    }
    const footnotes = {
      type: 'element',
      tagName: 'section',
      properties: { dataFootnotes: '' },
      children: [
        {
          type: 'element',
          tagName: 'li',
          properties: { id: 'note-1' },
          children: [
            { type: 'text', value: '   ' },
            {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [
                { type: 'text', value: 'Footnote body' },
                {
                  type: 'element',
                  tagName: 'a',
                  properties: { dataFootnoteBackref: '' },
                  children: [],
                },
              ],
            },
            { type: 'text', value: 'tail' },
          ],
        },
      ],
    }
    const tree = {
      type: 'root',
      children: [titled, code, footnotes, missingNoteRef, dummyRef, actualRef],
    }

    transform(tree)

    expect(tree.children[0]).toMatchObject({
      tagName: 'markee-title-tooltip',
      children: [
        titled,
        {
          tagName: 'markee-title-tooltip-content',
          children: [{ value: 'Link tip' }],
        },
      ],
    })
    expect(tree.children[1]).toBe(code)
    expect(tree.children[3]).toBe(missingNoteRef)
    expect(tree.children[4]).toBe(dummyRef)
    expect(tree.children[5]).toMatchObject({
      tagName: 'markee-title-tooltip',
      properties: { 'data-footnote-tooltip': '' },
    })
    expect((tree.children[5] as any).children[1]).toMatchObject({
      tagName: 'markee-title-tooltip-content',
      children: [
        {
          tagName: 'markee-title-tooltip-paragraph',
          children: [{ value: 'Footnote body' }],
        },
        { value: 'tail' },
      ],
    })
  })

  it('handles tooltip positioning, title removal/restoration, and cleanup listeners', async () => {
    await importTooltip()

    Object.defineProperty(document.body, 'scrollWidth', {
      configurable: true,
      value: 500,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 100,
    })

    const removeWindowListener = vi.spyOn(window, 'removeEventListener')

    const tooltip = document.createElement('markee-title-tooltip')
    tooltip.innerHTML =
      '<span title="Tip">Trigger</span><markee-title-tooltip-content></markee-title-tooltip-content>'
    const removeElementListener = vi.spyOn(tooltip, 'removeEventListener')
    document.body.append(tooltip)

    const content = tooltip.querySelector(
      'markee-title-tooltip-content',
    ) as HTMLElement
    const trigger = tooltip.firstElementChild as HTMLElement

    mockRect(tooltip, { x: 100, y: 10, width: 40, height: 20 })
    mockRect(content, { width: 80, height: 30 })

    tooltip.onmouseenter?.({ currentTarget: tooltip } as MouseEvent)

    expect(trigger.hasAttribute('title')).toBe(false)
    expect(content.style.left).toBe('80px')
    expect(content.style.top).toBe('34px')

    tooltip.onmouseleave?.({} as MouseEvent)
    expect(trigger.getAttribute('title')).toBe('Tip')

    const footnoteTooltip = document.createElement('markee-title-tooltip')
    footnoteTooltip.dataset.footnoteTooltip = ''
    footnoteTooltip.innerHTML =
      '<span>Footnote</span><markee-title-tooltip-content></markee-title-tooltip-content>'
    document.body.append(footnoteTooltip)

    const footnoteContent = footnoteTooltip.querySelector(
      'markee-title-tooltip-content',
    ) as HTMLElement
    mockRect(footnoteTooltip, { x: 50, y: 80, width: 20, height: 20 })
    mockRect(footnoteContent, { width: 40, height: 10 })

    footnoteTooltip.onmouseenter?.({ currentTarget: null } as MouseEvent)

    expect(footnoteContent.style.left).toBe('48px')
    expect(footnoteContent.style.top).toBe('66px')

    tooltip.disconnectedCallback()

    expect(removeElementListener).toHaveBeenCalledWith(
      'focusin',
      tooltip.onmouseenter,
    )
    expect(removeWindowListener).toHaveBeenCalledWith(
      'scroll',
      tooltip.onmouseenter,
    )
    expect(removeWindowListener).toHaveBeenCalledWith(
      'resize',
      tooltip.onmouseenter,
    )
  })
})
