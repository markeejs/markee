import type { Transformer } from 'unified'
import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import twemoji, { type Twemoji } from '@discordapp/twemoji'

export function remarkTwemoji(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (node.data?.twemoji) {
        return
      }

      const replaced = (twemoji as unknown as Twemoji).parse(node.value, {
        className: 'mk-twemoji',
      })

      if (replaced !== node.value && parent && index !== undefined) {
        const nextNodes = replaced
          .split(/(<img class="mk-twemoji"[^>]+?>)/g)
          .map((text, index) => {
            if (index % 2) {
              const alt = text.match(/alt="(.*?)"/)?.[1]
              const url = text.match(/src="(.*?)"/)?.[1] as string
              return {
                type: 'paragraph' as const,
                children: [
                  {
                    type: 'text' as const,
                    value: alt ?? '',
                    data: { twemoji: true, hName: 'span' },
                  },
                ],
                data: {
                  hName: 'img',
                  hProperties: {
                    type: 'image/png',
                    alt,
                    src: url,
                    draggable: false,
                    className: ['mk-twemoji', 'skip-lightbox'],
                    width: '18',
                    height: '18',
                    onerror: 'this.classList.toggle("mk-twemoji-failed", true)',
                  },
                },
              }
            } else {
              return { type: 'text' as const, value: text }
            }
          })

        parent.children.splice(index, 1, ...nextNodes)
      }
    })
  }
}

remarkTwemoji.flagSupport = (): Transformer<Root, Root> => {
  return (tree) => {
    visit(tree, 'text', (node) => {
      node.value = node.value.replace(/:flag_(.+?):/g, (_, flag) => {
        return `:${flag}:`
      })
    })
  }
}
