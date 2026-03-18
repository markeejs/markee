import { afterEach, describe, expect, it, vi } from 'vitest'

const markState = vi.hoisted(() => ({
  instances: [] as unknown[],
  calls: [] as Array<{ term: string; options: Record<string, unknown> }>,
}))

vi.mock('mark.js', () => ({
  default: class MockMark {
    constructor(target: unknown) {
      markState.instances.push(target)
    }

    mark(term: string, options: Record<string, unknown>) {
      markState.calls.push({ term, options })
      const done = options.done
      if (typeof done === 'function') done()
    }
  },
}))

const { highlight } = await import('./highlight')

afterEach(() => {
  markState.instances.length = 0
  markState.calls.length = 0
  document.body.innerHTML = ''
})

describe('highlight', () => {
  it('resets markable content and highlights long words before short ones', () => {
    document.body.innerHTML = `
      <section id="root">
        <p data-markable>stale</p>
        <div data-markable>stale</div>
      </section>
    `

    const root = document.getElementById('root') as HTMLElement
    const [paragraph, div] = Array.from(root.querySelectorAll('[data-markable]'))

    ;(paragraph as any).content = '<em>Alpha</em>'
    ;(div as any).content = '<strong>Beta</strong>'

    highlight(root, 'alpha be gamma to')

    expect(paragraph.innerHTML).toBe('<em>Alpha</em>')
    expect(div.innerHTML).toBe('<strong>Beta</strong>')
    expect(markState.instances).toHaveLength(1)
    expect(markState.calls).toHaveLength(2)
    expect(markState.calls[0].term).toBe('alpha gamma')
    expect(markState.calls[0].options.accuracy).toBe('complementary')
    expect(markState.calls[0].options.separateWordSearch).toBe(true)
    expect(markState.calls[1].term).toBe('be to')
    expect(markState.calls[1].options.accuracy).toBe('exactly')
  })

  it('uses partial matching when complementary mode is disabled', () => {
    document.body.innerHTML = `<section id="root"><p data-markable>stale</p></section>`
    const root = document.getElementById('root') as HTMLElement
    const markable = root.querySelector('[data-markable]') as HTMLElement
    ;(markable as any).content = 'Alpha'

    highlight(root, 'big on', false)

    expect(markState.calls).toHaveLength(2)
    expect(markState.calls[0].term).toBe('big')
    expect(markState.calls[0].options.accuracy).toBe('partially')
    expect(markState.calls[0].options.separateWordSearch).toBe(false)
    expect(markState.calls[1].term).toBe('on')
    expect(markState.calls[1].options.separateWordSearch).toBe(false)
  })
})
