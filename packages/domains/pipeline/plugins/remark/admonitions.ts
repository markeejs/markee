import { h } from 'hastscript'
import { visit } from 'unist-util-visit'
import type { Processor, Transformer } from 'unified'
import type { Content, Paragraph, Root } from 'mdast'

const titleAlias = {
  Tldr: 'TL;DR',
  Faq: 'FAQ',
}

/**
 * Deeply extract the text of a content node
 * @param value - content node to extract text from
 * @returns - extracted text
 */
function extractText(value: Content): string[] {
  if ('value' in value) {
    return [value.value]
  }
  if ('children' in value) {
    return value.children.flatMap(extractText)
  }
  return ['']
}

/**
 * Merge two sets of attributes
 * @param attributesA - first set
 * @param attributesB - second set
 * @returns - merged set
 */
function merge(
  attributesA: Record<string, any> & { className: any[] },
  attributesB: Record<string, any>,
) {
  return {
    ...attributesA,
    ...attributesB,
    className: [
      ...attributesA.className,
      ...(attributesB.className ?? []),
    ],
  }
}

/**
 * Takes information about an admonition block, and generates the correct AST to represent it
 * @param titleInfo - extracted title information
 * @param contentAst - extracted content as AST
 * @param linked - whether to link tabs or not
 * @returns - AST representation of the admonition
 */
function computeAdmonition(
  titleInfo: {
    tag: string
    kind?: string
    rest: string
    type: 'default' | 'collapsible' | 'tabs' | 'block'
    modifier: string
    extra: Content[]
  },
  contentAst: Content[],
  linked: boolean,
) {
  const title = (tag = 'div') => ({
    type: 'paragraph' as 'strong',
    data: {
      hName: tag,
      hProperties: {
        className: ['mk-admonition-title'],
      },
    },
    children:
      titleInfo.rest || titleInfo.extra.length
        ? [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text' as const,
                  value:
                    titleInfo.type === 'default'
                      ? (titleAlias[titleInfo.rest as 'Tldr'] ?? titleInfo.rest)
                      : titleInfo.rest,
                },
                ...titleInfo.extra,
              ],
            },
          ]
        : [],
  })
  const panel = () => ({
    type: 'paragraph' as 'strong',
    data: {
      hName: 'div',
      hProperties: {
        className: ['mk-admonition-content'],
      },
    },
    children: contentAst,
  })

  if (titleInfo.type === 'default') {
    return {
      type: 'paragraph' as const,
      data: {
        hName: 'div',
        hProperties: {
          className: ['mk-admonition', 'mk-' + titleInfo.tag],
        },
      },
      children: [title('div'), panel()],
    }
  }

  if (titleInfo.type === 'collapsible') {
    return {
      type: 'paragraph' as const,
      data: {
        hName: 'details',
        hProperties: {
          className: ['mk-admonition', 'mk-' + titleInfo.tag],
          open: titleInfo.modifier === 'expanded',
        },
      },
      children: [title('summary'), panel()],
    }
  }

  if (titleInfo.type === 'tabs') {
    return {
      type: 'paragraph' as const,
      data: {
        hName: 'div',
        hProperties: {
          linked: linked
            ? !(titleInfo.modifier === 'unlinked')
            : titleInfo.modifier === 'linked',
          className: ['mk-admonition', 'mk-' + titleInfo.tag],
        },
        kind: titleInfo.kind,
      },
      children: [title('label'), panel()],
    }
  }

  // Custom container
  return {
    type: 'paragraph' as const,
    data: {
      hName:
        titleInfo.tag.match(/^[a-z]([a-z0-9]*-?[a-z0-9]+)*$/) &&
        titleInfo.tag !== 'block'
          ? titleInfo.tag
          : 'div',
      hProperties: { className: titleInfo.tag === 'block' ? ['mk-block'] : [] },
    },
    children: [
      { type: 'text' as const, value: titleInfo.rest },
      ...panel().children,
    ],
  }
}

/**
 * Takes a list of tabs admonition, and collapse them into a single tabbed content
 * with the radio inputs to navigate between them
 * @param tabs - tabs to collapse
 * @param linked - whether the tabs should be linked tabs or free tabs
 * @param group - unique identifier for the tab group
 * @returns - AST representation of the grouped tabs
 */
function computeTabbedContent(
  tabs: Paragraph[],
  linked: boolean,
  group: number,
) {
  const titles = tabs.map((tab, index) => {
    return [
      {
        type: 'paragraph' as const,
        data: {
          hName: 'input',
          hProperties: {
            type: 'radio',
            name: 'label-tab-' + group,
            id: 'label-tab-' + group + '-' + index,
            className: ['mk-tabbed-label-input'],
            onchange: 'this.nextElementSibling.click();',
            ...(index ? {} : { checked: true }),
            ...(linked
              ? {
                  'data-tab': encodeURI(extractText(tab.children[0]).join('')),
                }
              : {}),
          },
        },
        children: [],
      },
      {
        ...tab.children[0],
        data: {
          ...tab.children[0].data,
          hProperties: {
            ...(tab.children[0].data?.hProperties as Record<string, string>),
            for: 'tab-' + group + '-' + index,
            className: ['mk-tabbed-title'],
            onclick: 'this.previousElementSibling.click();',
          },
        },
      },
    ]
  })
  const panels = tabs.map((tab, index) => [
    {
      type: 'paragraph' as const,
      data: {
        hName: 'input',
        hProperties: {
          type: 'radio',
          name: 'tab-' + group,
          id: 'tab-' + group + '-' + index,
          className: ['mk-tabbed-input'],
          ...(index ? {} : { checked: true }),
          ...(linked
            ? {
                'data-tab': encodeURI(extractText(tab.children[0]).join('')),
              }
            : {}),
        },
      },
      children: [],
    },
    {
      ...tab.children[1],
      data: {
        ...tab.children[1].data,
        hProperties: {
          ...(tab.children[1].data?.hProperties as Record<string, string>),
          className: ['mk-admonition-content', 'mk-tabbed-content'],
        },
      },
    },
  ])

  return {
    type: 'paragraph' as const,
    data: {
      hName: 'markee-tabs',
      hProperties: {
        className: [
          'mk-admonition',
          'mk-tabbed',
          'mk-tab',
          (tabs[0].data as any)?.kind
            ? ((' mk-' + (tabs[0].data as any).kind) as string)
            : '',
        ],
      },
    },
    children: [
      {
        type: 'paragraph' as const,
        data: {
          hName: 'div',
          hProperties: {
            className: [
              'mk-admonition-title',
              'mk-admonition-tabs',
              'mk-tabbed-tabs',
            ],
          },
        },
        children: titles.flat(),
      },
      ...panels.flat(),
    ],
  }
}

/**
 * Remark plugin for converting admonition blocks into their complex AST representation
 */
export function remarkAdmonitions(this: Processor): Transformer<Root, Root> {
  const tabbedContent = this.data().pluginConfig<{ linkTabs?: boolean }>(
    'tabbedContent',
  )
  const linked = tabbedContent?.linkTabs ?? true

  return (tree) => {
    // Transform directives
    visit(tree, 'leafDirective', (node: any, index, parent) => {
      // Clone the children to avoid double-visit issues
      const children = JSON.parse(
        JSON.stringify(
          node.children.filter((child: any) => !child.data?.directiveLabel),
        ),
      )
      const titleInfo = {
        type: 'block' as const,
        rest: '',
        tag: node.name,
        extra: [],
        modifier: '',
      }

      const admonition = computeAdmonition(titleInfo, children, linked)
      admonition.data.hProperties = node.attributes
        ? (h('div', node.attributes).properties as any)
        : {}

      if (index !== undefined && parent) {
        parent.children.splice(index, 1, {
          ...admonition,
          position: node.position,
        } as Content)
        return index
      }
    })

    visit(
      tree,
      'containerDirective',
      (
        node: {
          name: string
          tag: string
          children: any[]
          attributes: Record<string, any>
          position: number
        },
        index,
        parent: any,
      ) => {
        const title = node.children.find(
          (child: any) => child.data?.directiveLabel,
        )
        // Clone the children to avoid double-visit issues
        const children = JSON.parse(
          JSON.stringify(
            node.children.filter((child: any) => !child.data?.directiveLabel),
          ),
        )
        const titleInfo = {
          type: 'default' as 'default' | 'collapsible' | 'tabs' | 'block',
          rest: title ? '' : node.name?.[0].toUpperCase() + node.name?.slice(1),
          tag: node.name,
          extra: title && title.children?.length ? [title] : [],
          modifier: '',
          kind: '',
        }

        if (node.attributes && 'collapsed' in node.attributes) {
          titleInfo.type = 'collapsible'
          titleInfo.modifier =
            node.attributes.collapsed === 'false' ? 'expanded' : ''
          delete node.attributes.collapsed
        }

        if (node.name === 'tab') {
          titleInfo.type = 'tabs'
          titleInfo.tag = 'tabbed'

          if (node.attributes && 'kind' in node.attributes) {
            titleInfo.kind = node.attributes.kind
          }

          if (node.attributes && 'linked' in node.attributes) {
            titleInfo.modifier = 'linked'
            delete node.attributes.linked
          }
          if (node.attributes && 'unlinked' in node.attributes) {
            titleInfo.modifier = 'unlinked'
            delete node.attributes.unlinked
          }
        }

        if (node.name === 'draft') {
          node.name = 'markee-draft'
        }

        if (
          node.name === 'block' ||
          node.name.includes('-') ||
          !(
            ['cite', 'summary'].includes(node.name) ||
            document.createElement(node.name) instanceof HTMLUnknownElement
          )
        ) {
          titleInfo.type = 'block'
          titleInfo.rest = ''
          titleInfo.tag = node.name
        }

        const admonition = computeAdmonition(titleInfo, children, linked)
        admonition.data.hProperties = merge(
          admonition.data.hProperties,
          node.attributes ? (h('div', node.attributes).properties as any) : {},
        )

        if (index !== undefined && parent) {
          parent.children.splice(index, 1, {
            ...admonition,
            position: node.position,
          })
          return index
        }
      },
    )

    // Group tabs together
    visit(tree, 'paragraph', (node, index, parent) => {
      if (
        index !== undefined &&
        parent &&
        (node.data?.hProperties as Record<string, string>)?.className?.includes(
          'mk-tabbed',
        )
      ) {
        const nextSiblings = parent.children.slice(index + 1)
        const firstNonTabSibling = nextSiblings.findIndex((sibling) => {
          return !(
            (sibling.data as any)?.hProperties as Record<string, string>
          )?.className?.includes('mk-tabbed')
        })
        const siblings = nextSiblings.slice(
          0,
          firstNonTabSibling > -1 ? firstNonTabSibling : undefined,
        )

        const tabbed = computeTabbedContent(
          [node, ...(siblings as Paragraph[])],
          !!(node.data?.hProperties as Record<string, string>)?.linked,
          node.position?.start.offset ?? index,
        )

        parent.children.splice(index, siblings.length + 1, tabbed as Content)
      }
    })
  }
}
