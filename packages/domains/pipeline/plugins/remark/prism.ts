import type { Configuration } from '@markee/types'
import type { Root } from 'mdast'
import type { Processor, Transformer } from 'unified'
import { visit } from 'unist-util-visit'
import Prism from 'prismjs'

import { parseAttributes } from '../../helpers/attrs.js'

import { loadLanguage } from '../resources/prism-languages.js'
import './prism.extensions.js'

const knownAliases: Record<string, string> = {
  'terraform': 'hcl',
  'tf': 'hcl',
  'make': 'makefile',
  'dockerfile': 'docker',
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'golang': 'go',
  'yml': 'yaml',
  'shell': 'bash',
  'sh': 'bash',
  'c++': 'cpp',
  'c#': 'csharp',
}

/**
 * Remark plugin for loading prism data for code fences, and marking the code fence
 * with the correct additional attributes
 * Goes in pair with rehypePrism()
 */
export function remarkPrism(this: Processor): Transformer<Root, Root> {
  const { pluginConfig } = this.data()
  const prismConfig =
    pluginConfig<NonNullable<Configuration['plugins']>['prism']>('prism')
  return (tree) => {
    const loadPromises: Promise<void>[] = [
      import('./prism.plugins.js').then(() => {}),
    ]
    visit(tree, 'code', (node) => {
      const allAliases = {
        ...knownAliases,
        ...prismConfig?.aliases,
      }
      const lang =
        (node.lang && allAliases[node.lang.toLowerCase()]) ?? node.lang
      node.lang = lang

      if (lang) {
        loadPromises.push(loadLanguage(lang))
      }
      const attrs = parseAttributes(
        node.meta ?? '',
        (node.data?.hProperties as Record<string, string>) ?? {},
      )
      const prismProperties: Record<string, string> = {
        'class': 'language-' + lang,
        'data-prismjs-copy': '',
        'data-prismjs-copy-success': '',
        'data-prismjs-copy-error': '',
        'data-prismjs-copy-timeout': '1000',
      }
      if (attrs.hl_lines && typeof attrs.hl_lines === 'string') {
        prismProperties['data-line'] = attrs.hl_lines.replace(/[ ]+/g, ',')
        delete attrs.hl_lines
      }
      if (attrs.linenums) {
        prismProperties['data-start'] =
          typeof attrs.linenums === 'string' ? attrs.linenums : '1'
        prismProperties.class += ' line-numbers'
        delete attrs.linenums
      }

      node.data = {
        ...node.data,
        hProperties: {
          ...attrs,
          prism: JSON.stringify(prismProperties),
        },
      }
    })

    if (loadPromises.length) {
      Promise.allSettled(loadPromises).then(() => {
        const fences = document.querySelectorAll<HTMLElement>('pre > code')
        fences.forEach((fence) => {
          if (!fence.firstElementChild) {
            Prism.highlightElement(fence)
          }
        })
      })
    }
  }
}
