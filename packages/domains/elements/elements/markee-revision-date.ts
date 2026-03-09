import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'

import { state } from '@markee/runtime'
import { MarkeeElement } from '@markee/runtime'

@customElement('markee-revision-date')
export class MarkeeRevisionDate extends MarkeeElement.with({
  stores: [state.$currentLoader, state.$navigation],
}) {
  @property({ type: String, attribute: 'data-label' })
  label: string = 'Last updated:'

  @property({ type: String, attribute: 'data-format' })
  format: string = `{
              "month": "long",
              "day": "numeric",
              "year": "numeric"
           }`

  @property({ type: String, attribute: 'data-lang' })
  labelLang?: string = 'en'

  render() {
    const key = state.$currentLoader.get()?.data?.key ?? ''
    const { files } = state.$navigation.get()
    const fileData = files[key]

    const revisionDate = fileData?.revisionDate
    const dateFormat = new Intl.DateTimeFormat(
      this.labelLang,
      JSON.parse(this.format),
    )

    if (!revisionDate) return nothing

    return html`
      <span>
        ${this.label}&nbsp;${dateFormat.format(new Date(revisionDate))}
      </span>
    `
  }
}
