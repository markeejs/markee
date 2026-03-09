import { nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MarkeeElement } from '@markee/runtime'
import { state } from '@markee/runtime'

import './markee-color-scheme-manager.css'

@customElement('markee-color-scheme-manager')
export class MarkeeColorSchemeManager extends MarkeeElement.with({
  role: 'button',
  stores: [state.$colorScheme],
}) {
  @property({ type: String, attribute: 'data-base-class' })
  baseClass: string = 'fa fa-solid'

  @property({ type: String, attribute: 'data-class-auto' })
  classAuto: string = 'fa-circle-half-stroke'

  @property({ type: String, attribute: 'data-class-light' })
  classLight: string = 'fa-sun'

  @property({ type: String, attribute: 'data-class-dark' })
  classDark: string = 'fa-moon'

  @property({ type: String, attribute: 'data-title-auto' })
  titleAuto: string = 'System theme'

  @property({ type: String, attribute: 'data-title-light' })
  titleLight: string = 'Light theme'

  @property({ type: String, attribute: 'data-title-dark' })
  titleDark: string = 'Dark theme'

  connectedCallback() {
    super.connectedCallback()
    this.className = this.baseClass

    this.addEventListener('click', this.#handleClick)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('click', this.#handleClick)
  }

  #handleClick = () => {
    const current = state.$colorScheme.get()
    const preferred = matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    const inverted = preferred === 'light' ? 'dark' : 'light'

    if (current === preferred) state.$colorScheme.set('auto')
    if (current === inverted) state.$colorScheme.set(preferred)
    if (current === 'auto') state.$colorScheme.set(inverted)
  }

  render() {
    const colorScheme = state.$colorScheme.get()
    const schemes = ['auto', 'light', 'dark'] as const
    const classes = {
      auto: this.classAuto,
      light: this.classLight,
      dark: this.classDark,
    }
    const titles = {
      auto: this.titleAuto,
      light: this.titleLight,
      dark: this.titleDark,
    }

    this.title = titles[colorScheme]

    schemes.forEach((scheme) => this.classList.remove(classes[scheme]))
    this.classList.toggle(classes[colorScheme], true)

    return nothing
  }
}
