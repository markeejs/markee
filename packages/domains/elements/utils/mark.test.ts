import { describe, expect, it } from 'vitest'
import Mark from 'mark.js'
import { markApi } from './mark'

describe('markApi', () => {
  it('creates a real mark.js instance for a supported DOM target', () => {
    document.body.innerHTML = `
      <section id="root">
        <p>Alpha</p>
        <p>Beta</p>
      </section>
    `

    const root = document.getElementById('root') as HTMLElement
    const instance = markApi.create(root.querySelectorAll('p'))

    expect(instance).toBeInstanceOf(Mark)
    expect(typeof instance.mark).toBe('function')
    expect(typeof instance.unmark).toBe('function')
  })
})
