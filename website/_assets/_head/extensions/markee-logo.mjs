class MarkeeLogo extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <small>&lt;</small>
      mark<em>ee</em>
      <small>&nbsp;/&gt;</small>
    `
  }
}

customElements.define('markee-logo', MarkeeLogo)
