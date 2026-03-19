import { describe, expect, it } from 'vitest'
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
} from '@floating-ui/dom'
import { floatingUi } from './floating-ui'

describe('floatingUi', () => {
  it('re-exports the floating-ui DOM helpers through a stable local wrapper', () => {
    expect(floatingUi.autoUpdate).toBe(autoUpdate)
    expect(floatingUi.computePosition).toBe(computePosition)
    expect(floatingUi.flip).toBe(flip)
    expect(floatingUi.offset).toBe(offset)
    expect(floatingUi.shift).toBe(shift)
    expect(floatingUi.size).toBe(size)
  })
})
