import { extend } from '@markee/runtime'

function cloneNote(note) {
  return note.children
    ?.filter((ch) => !ch.value || ch.value.trim())
    .map((c) => {
      if ('children' in c) {
        return {
          ...c,
          tagName:
            c.tagName === 'p' ? 'markee-title-tooltip-paragraph' : c.tagName,
          children: c.children
            .filter(
              (ch) =>
                !(ch.properties && 'dataFootnoteBackref' in ch.properties),
            )
            .map((ch) => {
              return { ...ch }
            }),
        }
      }
      return { ...c }
    })
}

extend.markdownPipeline.rehype('markee-tooltips', function () {
  return (tree) => {
    const footnotes = this.data().pluginConfig('tooltips')?.footnotes
    const footnotesList = []

    if (footnotes) {
      extend.markdownPipeline.visit(tree, 'element', (element) => {
        if (
          element &&
          'properties' in element &&
          'dataFootnotes' in element.properties
        ) {
          extend.markdownPipeline.visit(element, 'element', (node) => {
            if (node && node.tagName === 'li') {
              footnotesList.push(node)
            }
          })
        }
      })
    }

    extend.markdownPipeline.visit(tree, 'element', (element, index, parent) => {
      if (
        element &&
        element.tagName !== 'code' &&
        'properties' in element &&
        'title' in element.properties
      ) {
        const value = element.properties.title

        parent.children[index] = {
          type: 'element',
          tagName: 'markee-title-tooltip',
          properties: {},
          children: [
            element,
            {
              type: 'element',
              tagName: 'markee-title-tooltip-content',
              properties: {},
              children: [{ type: 'text', value }],
            },
          ],
        }
      }

      if (
        footnotes &&
        element &&
        element.tagName === 'sup' &&
        element.children[0] &&
        'properties' in element.children[0] &&
        'dataFootnoteRef' in element.children[0].properties
      ) {
        const note = footnotesList.find(
          (n) =>
            n.properties.id === element.children[0].properties.href.slice(1),
        )
        if (!note || element?.properties?.dummy) return

        parent.children[index] = {
          type: 'element',
          tagName: 'markee-title-tooltip',
          properties: {
            'data-footnote-tooltip': '',
          },
          children: [
            { ...element },
            {
              type: 'element',
              tagName: 'markee-title-tooltip-content',
              properties: {},
              children: cloneNote(note),
            },
          ],
        }
      }
    })
  }
})

class MarkeeTitleTooltip extends HTMLElement {
  connectedCallback() {
    const title = this.firstElementChild.title
    this.onmouseenter = (e) => {
      if (e.currentTarget === this) {
        this.firstElementChild.removeAttribute('title')
      }
      const content = this.querySelector('markee-title-tooltip-content')
      const boundingRect = this.getBoundingClientRect()
      const { width, height } = content.getBoundingClientRect()

      const middlePoint = boundingRect.y + boundingRect.height / 2
      const maxOffset = document.body.scrollWidth - width - 4
      const contentOffset = 'footnoteTooltip' in this.dataset ? 12 : width / 2
      const positionOffset = 'footnoteTooltip' in this.dataset ? 12 : 4

      content.style.left =
        Math.min(
          maxOffset,
          boundingRect.x + boundingRect.width / 2 - contentOffset,
        ) + 'px'
      if (middlePoint > window.innerHeight / 2) {
        content.style.top = boundingRect.y - height - 4 + 'px'
      } else {
        content.style.top =
          boundingRect.y + boundingRect.height + positionOffset + 'px'
      }
    }
    this.onmouseleave = () => {
      if (title) {
        this.firstElementChild.setAttribute('title', title)
      }
    }

    this.addEventListener('focusin', this.onmouseenter)
    window.addEventListener('scroll', this.onmouseenter)
    window.addEventListener('resize', this.onmouseenter)
  }

  disconnectedCallback() {
    this.removeEventListener('focusin', this.onmouseenter)
    window.removeEventListener('scroll', this.onmouseenter)
    window.removeEventListener('resize', this.onmouseenter)
  }
}

window.customElements.define('markee-title-tooltip', MarkeeTitleTooltip)
