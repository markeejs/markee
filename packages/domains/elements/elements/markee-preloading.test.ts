import { describe, expect, it } from 'vitest'

import { MarkeePreloading } from './markee-preloading'

describe('markee-preloading', () => {
  it('renders three placeholder blocks', async () => {
    const element = new MarkeePreloading()
    document.body.append(element)

    await element.updateComplete

    expect(element.querySelectorAll('div')).toHaveLength(3)
    expect(element.textContent?.trim()).toBe('')
  })
})
