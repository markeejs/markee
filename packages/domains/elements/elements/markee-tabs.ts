import { customElement } from 'lit/decorators.js'

@customElement('markee-tabs')
export class MarkeeTabs extends HTMLElement {
  static treating = false
  connectedCallback() {
    this.querySelectorAll<HTMLInputElement>(
      '.mk-tabbed-input[data-tab]',
    ).forEach((input) => {
      input.onchange = (e) => {
        if (MarkeeTabs.treating) return
        MarkeeTabs.treating = true
        const target = e.currentTarget as HTMLInputElement
        const linked = document.querySelectorAll(
          '[data-tab="' + target.dataset.tab + '"]',
        )
        linked.forEach((l) => (l as HTMLInputElement).click())
        MarkeeTabs.treating = false
      }

      if (input.checked) {
        MarkeeTabs.treating = true
        const linked = document.querySelectorAll(
          '[data-tab="' + input.dataset.tab + '"]',
        )
        linked.forEach((l) => (l as HTMLInputElement).click())
        MarkeeTabs.treating = false
      }
    })
  }
}
