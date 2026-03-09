import { LitElement } from 'lit'
import { withStores } from '@nanostores/lit'

export function BooleanConverter(value: string | null) {
  if (value === 'false') return false
  return value != null
}

export class MarkeeElement extends LitElement {
  static tag(name: string) {
    customElements.define(name, this)
  }

  static with(options: {
    stores?: Parameters<typeof withStores>[1]
    role?: string
  }) {
    const BaseClass = options.stores ? withStores(this, options.stores) : this
    return class extends BaseClass {
      constructor() {
        super()
        if (options.role) {
          this.setAttribute('aria-role', options.role)
        }
      }
    }
  }

  createRenderRoot() {
    return this
  }
}
