import { describe, expect, it } from 'vitest'

import './markee-draft'

describe('markee-draft', () => {
  it('can be imported for its styles without registering a custom element', () => {
    expect(customElements.get('markee-draft')).toBeUndefined()
    expect(document.head.innerHTML).toContain('markee-draft')
    expect(document.head.innerHTML).toContain('@layer markee')
  })
})
