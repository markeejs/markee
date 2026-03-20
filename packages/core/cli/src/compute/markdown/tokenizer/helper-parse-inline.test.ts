import { describe, expect, it } from 'vitest'

import {
  checkLinkAttributes,
  findHtmlAttrUrls,
  findInlineLinkAndImageUrls,
  findReferenceDefinitionUrls,
  keepOnlyCodeComments,
  keepOnlyHtmlComments,
  neutralizeRanges,
} from './helper-parse-inline.js'

function extractSpans(
  source: string,
  spans: { line: number; colStart: number; colEnd: number }[],
) {
  const lines = source.split('\n')
  return spans.map((span) =>
    lines[span.line]?.slice(span.colStart, span.colEnd),
  )
}

describe('helper-parse-inline', () => {
  it('neutralizes code spans and script/style HTML constructs', () => {
    const source = [
      'Before `code`',
      'Around ``co`de`` text',
      '<!-- hidden comment -->',
      '<   script>spaced opener</script>',
      '<?   script>prefixed opener</script>',
      '<script>window.location = "/secret"</script>',
      '<script   >trailing whitespace attr scan</script>',
      '<script =>missing attr name</script>',
      '<script type=  module>whitespace after equals</script>',
      '<script =broken src=foo></script>',
      '<script type=module/>slash delimiter</script>',
      '<script type=module>unquoted attr value</script>',
      '<script type="module">quoted attr value</script>',
      '<style>.x { color: red; }</style>',
      '<style media=screen>.y { color: blue; }</style>',
      '<script>truncated close</scr',
      '<script>boundary close</script',
      '<script><span>unterminated raw text',
      'After [link](./guide.md)',
    ].join('\n')

    const neutralized = neutralizeRanges(source)

    expect(neutralizeRanges('<div><!-- missing')).toContain('missing')
    expect(neutralizeRanges('<script>unterminated raw text')).toContain(
      'unterminated raw text',
    )
    expect(neutralizeRanges('<script>end boundary</script')).not.toContain(
      'end boundary',
    )
    expect(neutralized).not.toContain('window.location')
    expect(neutralized).not.toContain('spaced opener')
    expect(neutralized).not.toContain('prefixed opener')
    expect(neutralized).not.toContain('truncated close')
    expect(neutralized).not.toContain('boundary close')
    expect(neutralized).not.toContain('co`de')
    expect(neutralized).not.toContain('hidden comment')
    expect(neutralized).not.toContain('src=foo')
    expect(neutralized).not.toContain('screen')
    expect(neutralized).not.toContain('whitespace after equals')
    expect(neutralized).not.toContain('slash delimiter')
    expect(neutralized).not.toContain('unquoted attr value')
    expect(neutralized).not.toContain('quoted attr value')
    expect(neutralized).not.toContain('.x { color: red; }')
    expect(neutralized).not.toContain('.y { color: blue; }')
    expect(neutralized).not.toContain('code')
    expect(neutralized).toContain('[link](./guide.md)')
  })

  it('keeps only comments for supported code syntaxes and html', () => {
    const javascript = [
      'const a = 1',
      '// [doc](./comment.md)',
      'const b = `template`',
      '/* block [ref](./block.md) */',
    ].join('\n')
    const python = [
      '"""[doc](./docstring.md)"""',
      'value = 1',
      '# [note](./py.md)',
    ].join('\n')
    const pythonStrings = [
      'if True:',
      '"""[function](./function.md)"""',
      'value = 1',
      '"""[ignored](./ignored.md)"""',
    ].join('\n')
    const quotedJavascript = [
      'const triple = """ignored"""',
      'const value = "a\\\"b"',
      '// [quoted](./quoted-comment.md)',
    ].join('\n')
    const html = ['<div>visible</div>', '<!-- [html](./comment.html) -->'].join(
      '\n',
    )

    expect(keepOnlyCodeComments(javascript, 'ts')).toContain('./comment.md')
    expect(keepOnlyCodeComments(javascript, 'ts')).toContain('./block.md')
    expect(keepOnlyCodeComments(javascript, 'ts')).not.toContain('const a = 1')
    expect(keepOnlyCodeComments(python, 'py')).toContain('./py.md')
    expect(keepOnlyCodeComments(python, 'py')).toContain('./docstring.md')
    expect(keepOnlyCodeComments(pythonStrings, 'py')).toContain('./function.md')
    expect(keepOnlyCodeComments(pythonStrings, 'py')).not.toContain(
      './ignored.md',
    )
    expect(keepOnlyCodeComments('# [ruby](./rb.md)', 'rb')).toContain('./rb.md')
    expect(
      keepOnlyCodeComments('// [fallback](./default.md)', 'unknown'),
    ).toContain('./default.md')
    expect(keepOnlyCodeComments(quotedJavascript, 'js')).toContain(
      './quoted-comment.md',
    )
    expect(keepOnlyCodeComments('const value = 1', 'js')).not.toContain('value')
    expect(keepOnlyHtmlComments(html)).toContain('./comment.html')
    expect(keepOnlyHtmlComments(html)).not.toContain('<div>visible</div>')
    expect(keepOnlyHtmlComments('<div>plain</div>')).not.toContain('plain')
  })

  it('finds markdown, html, and reference-definition URLs and reads following link attrs', () => {
    const markdown = [
      '[doc](./guide.md){version=latest}',
      '![img](./image.png)',
      String.raw`\[escaped](./ignore.md)`,
      '[ref]: ./reference.md',
    ].join('\n')
    const html = [
      '<!-- <a href="./ignore.html"> -->',
      '<img src="./image.jpg" srcset="./a.jpg 1x, ./b.jpg 2x">',
      '<img srcset="./solo.jpg 1x,   ">',
      '<img src="  ./trimmed.jpg  ">',
      '<a href="./page.html">Page</a>',
      '<![CDATA[<a href="./ignore-cdata.html">]]>',
    ].join('\n')

    const inlineUrls = extractSpans(
      markdown,
      findInlineLinkAndImageUrls(markdown),
    )
    const htmlUrls = extractSpans(html, findHtmlAttrUrls(html))
    const referenceUrls = extractSpans(
      markdown,
      findReferenceDefinitionUrls(markdown),
    )

    expect(inlineUrls).toEqual(['./guide.md', './image.png'])
    expect(referenceUrls).toEqual(['./reference.md'])
    expect(htmlUrls).toEqual([
      './image.jpg',
      './a.jpg',
      './b.jpg',
      './solo.jpg',
      './trimmed.jpg',
      './page.html',
    ])
    expect(
      checkLinkAttributes(markdown.indexOf('./guide.md'), markdown),
    ).toEqual({
      version: 'latest',
    })
    expect(
      checkLinkAttributes(markdown.indexOf('./image.png'), markdown),
    ).toBeUndefined()
  })

  it('handles reference-definition indentation and escaped link attrs', () => {
    const markdown = [
      '   [indented]: ./spaced.md',
      '[nested [label]]: ./nested.md',
      String.raw`[escaped \] label]: ./escaped.md`,
      '[broken]:\r',
      '  ./wrapped.md',
      '[broken [label]: ./ignored.md',
    ].join('\n')
    const attrsSource = String.raw`[doc](./guide.md){data-label="a\}b"}`

    const referenceUrls = extractSpans(
      markdown,
      findReferenceDefinitionUrls(markdown),
    )

    expect(referenceUrls).toEqual([
      './spaced.md',
      './nested.md',
      './escaped.md',
      './wrapped.md',
    ])
    expect(findReferenceDefinitionUrls('[empty]:')).toEqual([])
    expect(
      findReferenceDefinitionUrls('[ref-broken]: <./broken\nnext'),
    ).toEqual([])
    expect(() =>
      checkLinkAttributes(attrsSource.indexOf('./guide.md'), attrsSource),
    ).toThrow()
  })

  it('parses quoted titles, parenthesized titles, and deactivates outer nested links', () => {
    const markdown = [
      '[quoted](<./quoted.md> "ti\\\"tle")',
      '[paren](./paren.md (nested (title)))',
      '[paren-escaped](./paren-escaped.md (ti\\)tle))',
      '[url-paren](./url(paren).md)',
      '[escaped](./escaped\\).md)',
      '[outer [inner](./inner.md)](./outer.md)',
    ].join('\n')

    const inlineUrls = extractSpans(
      markdown,
      findInlineLinkAndImageUrls(markdown),
    )

    expect(inlineUrls).toEqual([
      './quoted.md',
      './paren.md',
      './paren-escaped.md',
      './url(paren).md',
      './escaped\\).md',
      './inner.md',
    ])
  })

  it('ignores invalid inline destinations and parses angle-bracketed reference destinations', () => {
    const markdown = [
      '[bad](./bad.md invalid)',
      '[bad-title](./bad.md (title)',
      '[bad-quote](./bad.md "title"x)',
      '[missing](./missing.md "unterminated"',
      '[good]: <./angle.md>',
      '[escaped]: <./angle\\>.md>',
      '[broken]: <./wrapped',
    ].join('\n')

    const inlineUrls = extractSpans(
      markdown,
      findInlineLinkAndImageUrls(markdown),
    )
    const referenceUrls = extractSpans(
      markdown,
      findReferenceDefinitionUrls(markdown),
    )

    expect(inlineUrls).toEqual([])
    expect(referenceUrls).toEqual(['./angle.md', './angle\\>.md'])
  })

  it('ignores unterminated quoted and parenthesized titles explicitly', () => {
    const markdown = [
      '[quote](./quote.md "unterminated)',
      '[paren](./paren.md (unterminated',
    ].join('\n')

    const inlineUrls = extractSpans(
      markdown,
      findInlineLinkAndImageUrls(markdown),
    )

    expect(inlineUrls).toEqual([])
  })

  it('skips closing tags and processing instructions and reads unquoted html attributes', () => {
    const html = [
      '</a>',
      '<?xml version="1.0"?>',
      '<img src=image.jpg />',
      '<img alt=cover src=poster.jpg>',
      '<div =broken href=page.html></div>',
    ].join('\n')

    const htmlUrls = extractSpans(html, findHtmlAttrUrls(html))

    expect(htmlUrls).toEqual(['image.jpg', 'poster.jpg', 'page.html'])
  })

  it('tolerates malformed markdown and html edge cases without producing bogus spans', () => {
    const malformedMarkdown = [
      '[empty]()',
      '[unterminated](',
      '[angle](<./broken.md)',
      '[newline](./broken',
      ')',
      '[ref-broken]: <./broken',
    ].join('\n')
    const attrsSource = '[doc](./guide.md){  data-label="x"  }'

    expect(keepOnlyHtmlComments('<!-- missing')).not.toContain('missing')
    expect(neutralizeRanges('<script')).toBe('<script')
    expect(findHtmlAttrUrls('<div data=x><!-- missing')).toEqual([])
    expect(findHtmlAttrUrls('<div data=x><![CDATA[')).toEqual([])
    expect(findHtmlAttrUrls('<![CDATA[')).toEqual([])
    expect(findHtmlAttrUrls('<div><img src="./broken.png"')).toEqual([])
    expect(findHtmlAttrUrls('<img src="./broken.png"')).toEqual([])
    expect(findHtmlAttrUrls('<div data=x><img   >')).toEqual([])
    expect(findHtmlAttrUrls('<img src=>')).toEqual([])
    expect(findHtmlAttrUrls('<img src=   >')).toEqual([])
    expect(findHtmlAttrUrls('<img src="./wrapped\n.png">')).toEqual([])
    expect(
      extractSpans(
        '<img srcset="./trail.jpg,">',
        findHtmlAttrUrls('<img srcset="./trail.jpg,">'),
      ),
    ).toEqual(['./trail.jpg'])
    expect(findHtmlAttrUrls('<img srcset="   ">')).toEqual([])
    expect(
      extractSpans('<img src=x/>', findHtmlAttrUrls('<img src=x/>')),
    ).toEqual(['x'])
    expect(
      extractSpans(
        '< img src="./spaced.png">',
        findHtmlAttrUrls('< img src="./spaced.png">'),
      ),
    ).toEqual(['./spaced.png'])
    expect(findInlineLinkAndImageUrls(malformedMarkdown)).toEqual([])
    expect(findInlineLinkAndImageUrls('plain text')).toEqual([])
    expect(findInlineLinkAndImageUrls('[tail](')).toEqual([])
    expect(findInlineLinkAndImageUrls('[tail](./tail')).toEqual([])
    expect(
      keepOnlyCodeComments('value = """[inline](./inline.md)"""', 'py'),
    ).not.toContain('./inline.md')
    expect(
      checkLinkAttributes(attrsSource.indexOf('./guide.md'), attrsSource),
    ).toEqual({
      'data-label': 'x',
    })
  })
})
