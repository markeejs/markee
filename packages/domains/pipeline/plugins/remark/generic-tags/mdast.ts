import type { Extension, Handle } from 'mdast-util-from-markdown'
import type { Options as ToMarkdownExtension } from 'mdast-util-to-markdown'

/**
 * List of constructs that occur in phrasing (paragraphs, headings), but cannot
 * contain generic tag.
 * So they sort of cancel each other out.
 */
const constructsWithoutGenericTag = [
  'autolink',
  'destinationLiteral',
  'destinationRaw',
  'reference',
  'titleQuote',
  'titleApostrophe',
]

export function mdastGenericTag(options: { name: string; character: string }) {
  /**
   * Create an extension for `mdast-util-from-markdown` to enable GFM
   * strikethrough in markdown.
   *
   * @returns
   *   Extension for `mdast-util-from-markdown` to enable GFM strikethrough.
   */
  function genericTagFromMarkdown(): Extension {
    return {
      canContainEols: [options.name],
      enter: { [options.name]: enterGenericTag },
      exit: { [options.name]: exitGenericTag },
    }
  }

  /**
   * Create an extension for `mdast-util-to-markdown` to enable GFM
   * strikethrough in markdown.
   *
   * @returns
   *   Extension for `mdast-util-to-markdown` to enable GFM strikethrough.
   */
  function genericTagToMarkdown(): ToMarkdownExtension {
    return {
      unsafe: [
        {
          character: options.character,
          inConstruct: 'phrasing',
          notInConstruct: constructsWithoutGenericTag as any,
        },
      ],
    }
  }

  const enterGenericTag: Handle = function (token) {
    this.enter(
      {
        type: options.name as any,
        children: [],
        data: { hName: options.name },
      },
      token,
    )
  }

  const exitGenericTag: Handle = function (token) {
    this.exit(token)
  }

  return {
    genericTagFromMarkdown,
    genericTagToMarkdown,
  }
}
