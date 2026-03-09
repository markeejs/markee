import { state } from '@markee/runtime'
import { extend } from '@markee/runtime'

import './index.css'

const placeholders = new Map<string, Placeholder[]>()
const values = new Map<string, string>()
const scopes = new Map<string, Map<string, string>>()
const refreshInputs = () =>
  document
    .querySelectorAll('markee-placeholder-inputs')
    ?.forEach((e: any) => e.refresh())

state.$router.subscribe(() => values.clear())

function getValueMap(scope?: string) {
  if (scope) {
    const map = scopes.get(scope) ?? new Map<string, string>()
    scopes.set(scope, map)
    return map
  }
  return values
}

function saveScopes() {
  const jsonScopes = [...scopes.entries()].map(([scope, map]) => [
    scope,
    [...map.entries()],
  ])
  sessionStorage?.setItem(
    'markee::placeholders::scopes',
    JSON.stringify(jsonScopes),
  )
}

function loadScopes() {
  const jsonScopes = JSON.parse(
    sessionStorage?.getItem('markee::placeholders::scopes') ?? '[]',
  )
  jsonScopes.forEach(([scope, content]: [string, [string, string][]]) => {
    scopes.set(scope, new Map(content))
  })
}

loadScopes()

class Placeholder extends HTMLElement {
  value: string = ''
  connectedCallback() {
    const initialValue = this.textContent ?? ''
    this.value =
      initialValue + (this.dataset.scope ? `::${this.dataset.scope}` : '')
    const valueMap = getValueMap(this.dataset.scope)

    const currentValue = valueMap.get(this.value) ?? initialValue
    const root = this.dataset.tag ?? 'span'
    this.innerHTML =
      this.tagName === 'MARKEE-PLACEHOLDER'
        ? `<${root} contenteditable data-value>${currentValue}</${root}><i class="fa-fontawesome fa-solid fa-pen"></i>`
        : `<${root} data-value>${currentValue}</${root}>`

    const placeholder = placeholders.get(this.value) ?? []
    placeholder.push(this)
    placeholders.set(this.value, placeholder)

    refreshInputs()

    this.querySelector('[contenteditable]')?.addEventListener('input', () => {
      const next = this.textContent as string
      valueMap.set(this.value, next)
      saveScopes()

      placeholders.get(this.value)?.forEach((p) => {
        if (p !== this) {
          const dataValue = p.querySelector('[data-value]')
          const input = p.querySelector('input')

          if (dataValue) {
            dataValue.textContent = next
          }

          if (input) {
            input.value = next
          }
        }
      })
      refreshInputs()
    })
  }
  disconnectedCallback() {
    const placeholder = (placeholders.get(this.value) ?? []).filter(
      (p) => p !== this,
    )
    if (placeholder.length) {
      placeholders.set(this.value, placeholder)
    } else {
      placeholders.delete(this.value)
    }
    refreshInputs()
  }
}

class PlaceholderInputs extends HTMLElement {
  connectedCallback() {
    this.replaceChildren(document.createElement('table'))

    this.children[0].replaceChildren(
      document.createElement('thead'),
      document.createElement('tbody'),
    )

    this.children[0].children[0].replaceChildren(document.createElement('tr'))
    this.children[0].children[0].children[0].replaceChildren(
      document.createElement('th'),
      document.createElement('th'),
    )
    this.children[0].children[0].children[0].children[0].replaceChildren(
      'Variable',
    )
    this.children[0].children[0].children[0].children[1].replaceChildren(
      'Value',
    )

    this.refresh()
  }
  refresh() {
    const variables = Array.from(placeholders.keys())
    const rows = variables.map((variable) => {
      const [name, scope] = variable.split('::')

      const row = document.createElement('tr')
      const td1 = document.createElement('td')
      const td2 = document.createElement('td')
      const input = document.createElement('input')

      input.value = placeholders.get(variable)?.[0].textContent!
      input.addEventListener('input', () => {
        const next = input.value
        const valueMap = getValueMap(scope)
        valueMap.set(variable, next)
        saveScopes()

        placeholders.get(variable)?.forEach((p) => {
          const dataValue = p.querySelector('[data-value]')
          const input = p.querySelector('input')

          if (dataValue) {
            dataValue.textContent = next
          }

          if (input) {
            input.value = next
          }
        })
      })

      td1.replaceChildren(name)
      td2.replaceChildren(input)
      row.replaceChildren(td1, td2)

      if (scope) {
        const scopeContainer = document.createElement('small')
        const scopeIcon = document.createElement('i')
        scopeIcon.className = 'fa fa-rectangle-list'
        scopeContainer.replaceChildren(scopeIcon, scope)
        td1.append(scopeContainer)
      }

      return row
    })

    this.children[0]?.children[1].replaceChildren(...rows)
  }
}

customElements.define('markee-placeholder', Placeholder)
customElements.define(
  'markee-placeholder-variable',
  class extends Placeholder {},
)
customElements.define('markee-placeholder-inputs', PlaceholderInputs)

extend.markdownPipeline.rehype('placeholders', () => (tree) => {
  extend.markdownPipeline.visit(tree, 'element', (elem) => {
    if ('placeholder' in (elem.properties ?? {})) {
      delete elem.properties.placeholder
      elem.properties = {
        dataScope: Object.keys(elem.properties).join(' '),
        dataTag: elem.tagName,
      }
      elem.tagName = 'markee-placeholder'
    }

    if ('variable' in (elem.properties ?? {})) {
      delete elem.properties.variable
      elem.properties = {
        dataScope: Object.keys(elem.properties).join(' '),
        dataTag: elem.tagName,
      }
      elem.tagName = 'markee-placeholder-variable'
    }
  })
})

const codeBlocksCache = new WeakMap<Element, string>()

const observer = new MutationObserver(() => {
  const codeBlocks = document.querySelectorAll('code[placeholders]')
  observer.disconnect()
  codeBlocks.forEach((code) => {
    const needsReplace =
      !code.querySelector('markee-placeholder') &&
      !code.querySelector('markee-placeholder-variable') &&
      (code.parentElement?.getAttribute('tabindex') !== null ||
        code.parentElement?.tagName !== 'PRE')

    if (needsReplace) {
      const replaced =
        codeBlocksCache.get(code) ||
        code.innerHTML
          .replace(
            /(?:<span class="token punctuation">)?\[(?:<\/span>)?([^[\]{}]+?)(?:<span class="token punctuation">)?](?:<\/span>)?(?:<span class="token punctuation">)?\{(?:<\/span>)?placeholder(\s[^{}]+)?(?:<span class="token punctuation">)?}(?:<\/span>)?/g,
            (...args) => {
              return `<markee-placeholder data-scope=${args[2] ?? ''}>${args[1]}</markee-placeholder>`
            },
          )
          .replace(
            /(?:<span class="token punctuation">)?\[(?:<\/span>)?([^[\]{}]+?)(?:<span class="token punctuation">)?](?:<\/span>)?(?:<span class="token punctuation">)?\{(?:<\/span>)?variable(\s[^{}]+)?(?:<span class="token punctuation">)?}(?:<\/span>)?/g,
            (...args) => {
              return `<markee-placeholder-variable data-scope=${args[2] ?? ''}>${args[1]}</markee-placeholder-variable>`
            },
          )

      if (code.innerHTML !== replaced) {
        codeBlocksCache.set(code, replaced)
        code.innerHTML = replaced
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
})
observer.observe(document.body, { childList: true, subtree: true })
