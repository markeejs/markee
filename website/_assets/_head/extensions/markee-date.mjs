class MarkeeDate extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `${new Date().getFullYear()}`
  }
}

customElements.define('markee-date', MarkeeDate)
