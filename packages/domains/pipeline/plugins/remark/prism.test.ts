import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismState = vi.hoisted(() => ({
  highlightElement: vi.fn(),
  loadLanguage: vi.fn(async () => {}),
}))

vi.mock('prismjs', () => ({
  default: {
    highlightElement: prismState.highlightElement,
  },
}))

vi.mock('../resources/prism-languages.js', () => ({
  loadLanguage: prismState.loadLanguage,
}))

vi.mock('./prism.extensions.js', () => ({}))
vi.mock('./prism.plugins.js', () => ({}))

import { remarkPrism } from './prism.js'

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('remarkPrism', () => {
  beforeEach(() => {
    prismState.highlightElement.mockReset()
    prismState.loadLanguage.mockReset()
    prismState.loadLanguage.mockImplementation(async () => {})
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  it('normalizes aliases, parses prism attrs, and highlights only empty rendered fences', async () => {
    document.body.innerHTML = [
      '<pre><code id="first"></code></pre>',
      '<pre><code id="second"><span>already highlighted</span></code></pre>',
    ].join('')

    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'ts',
          meta: 'hl_lines="1 3" class="alpha"',
          data: {
            hProperties: {
              'data-existing': 'yes',
            },
          },
          value: 'const a = 1',
        },
        {
          type: 'code',
          lang: 'custom',
          meta: 'linenums="7"',
          value: 'print(1)',
        },
        {
          type: 'code',
          lang: 'js',
          data: {
            hProperties: {
              linenums: true,
            },
          },
          value: 'console.log(1)',
        },
        {
          type: 'code',
          value: 'plain text',
        },
      ],
    }

    const transform = remarkPrism.call({
      data() {
        return {
          pluginConfig(plugin: string) {
            if (plugin === 'prism') {
              return {
                aliases: {
                  custom: 'python',
                },
              }
            }
            return undefined
          },
        }
      },
    } as any) as any

    transform(tree)
    await flush()
    await flush()

    expect(prismState.loadLanguage).toHaveBeenCalledTimes(3)
    expect(prismState.loadLanguage).toHaveBeenNthCalledWith(1, 'typescript')
    expect(prismState.loadLanguage).toHaveBeenNthCalledWith(2, 'python')
    expect(prismState.loadLanguage).toHaveBeenNthCalledWith(3, 'javascript')

    expect(tree.children[0].lang).toBe('typescript')
    expect(tree.children[1].lang).toBe('python')
    expect(tree.children[2].lang).toBe('javascript')
    expect(tree.children[3].lang).toBeUndefined()

    expect(tree.children[0].data).toEqual({
      hProperties: {
        'data-existing': 'yes',
        className: ['alpha'],
        prism: JSON.stringify({
          class: 'language-typescript',
          'data-prismjs-copy': '',
          'data-prismjs-copy-success': '',
          'data-prismjs-copy-error': '',
          'data-prismjs-copy-timeout': '1000',
          'data-line': '1,3',
        }),
      },
    })
    expect(tree.children[1].data).toEqual({
      hProperties: {
        prism: JSON.stringify({
          class: 'language-python line-numbers',
          'data-prismjs-copy': '',
          'data-prismjs-copy-success': '',
          'data-prismjs-copy-error': '',
          'data-prismjs-copy-timeout': '1000',
          'data-start': '7',
        }),
      },
    })
    expect(tree.children[2].data).toEqual({
      hProperties: {
        prism: JSON.stringify({
          class: 'language-javascript line-numbers',
          'data-prismjs-copy': '',
          'data-prismjs-copy-success': '',
          'data-prismjs-copy-error': '',
          'data-prismjs-copy-timeout': '1000',
          'data-start': '1',
        }),
      },
    })
    expect(tree.children[3].data).toEqual({
      hProperties: {
        prism: JSON.stringify({
          class: 'language-undefined',
          'data-prismjs-copy': '',
          'data-prismjs-copy-success': '',
          'data-prismjs-copy-error': '',
          'data-prismjs-copy-timeout': '1000',
        }),
      },
    })

    expect(prismState.highlightElement).toHaveBeenCalledTimes(1)
    expect(prismState.highlightElement).toHaveBeenCalledWith(
      document.getElementById('first'),
    )
  })

  it('uses built-in aliases when there is no prism config override', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'tf',
          meta: '',
          value: 'resource "x" "y" {}',
        },
      ],
    }

    const transform = remarkPrism.call({
      data() {
        return {
          pluginConfig() {
            return undefined
          },
        }
      },
    } as any) as any

    transform(tree)
    await flush()
    await flush()

    expect(prismState.loadLanguage).toHaveBeenCalledWith('hcl')
    expect(tree.children[0].lang).toBe('hcl')
  })
})
