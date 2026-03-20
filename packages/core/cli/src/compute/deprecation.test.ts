import { describe, expect, it } from 'vitest'

import { DeprecationCompute } from './deprecation.js'

describe('DeprecationCompute', () => {
  it('converts legacy admonitions, collapsible blocks, tabs, and generic div directives', () => {
    const input = [
      '!!! info "Title" {#anchor}',
      '    body',
      '???+ note',
      '    nested',
      '===! Tab A',
      '    tab body',
      '||| hero {.wide}',
      '    text',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output).toContain(':::info[Title]{#anchor}')
    expect(output).toContain(':::note{collapsed="false"}')
    expect(output).toContain(':::tab[Tab]{linked}')
    expect(output).toContain(':::div{.wide}')
    expect(output).toContain('body')
    expect(output).toContain('nested')
    expect(output).toContain('tab body')
    expect(output).toContain('text')
  })

  it('supports collapsed admonitions and unlinked tabs without modifiers defaulting to expanded/linked', () => {
    const input = [
      '???- warning',
      '    body',
      '???+ warning "Titled"',
      '    body two',
      '===? Tab B',
      '    tab body',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output).toContain(':::warning{collapsed}')
    expect(output).toContain(':::warning[Titled]{collapsed="false"}')
    expect(output).toContain(':::tab[Tab]{unlinked}')
  })

  it('wraps implicit front matter and leaves fenced code blocks untouched', () => {
    const input = [
      'title: Hello',
      'description: World',
      '',
      '```md',
      '!!! warning',
      '    not converted',
      '```',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output.startsWith('---\n')).toBe(true)
    expect(output).toContain('\n---\n\n```md')
    expect(output).toContain('!!! warning')
    expect(output).not.toContain(':::warning')
  })

  it('preserves unrelated indented content and sanitizes malformed directive args', () => {
    const input = [
      'Paragraph',
      '    code block',
      '',
      "!!! tip 'Loose'   foo=bar",
      '    body',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output).toContain('Paragraph\n    code block')
    expect(output).toContain(':::tip[Loose]')
    expect(output).not.toContain('foo=bar')
  })

  it('uses the longest nested fence and handles collapsible and tab directives without modifiers', () => {
    const input = [
      '!!! outer',
      '    ??? note',
      '        body',
      '    === Tab C',
      '        tab body',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output).toContain(':::outer')
    expect(output).toContain(':::note{collapsed}')
    expect(output).toContain(':::tab[Tab]')
  })

  it('converts generic div directives without a title body', () => {
    const output = DeprecationCompute.convertDeprecatedSyntaxes(
      ['||| {.wide}', '    body'].join('\n'),
    )

    expect(output).toContain(':::div{.wide}')
    expect(output).toContain('\nbody\n')
  })

  it('handles unknown admonition kinds, modifier-only tabs, and divs without title text', () => {
    const input = [
      '!!!',
      '    body',
      '===! {#anchor}',
      '    linked tab body',
      '===? {#anchor-two}',
      '    unlinked tab body',
      '|||',
      '    bare div body',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output).toContain(':::unknown')
    expect(output).toContain(':::tab{linked #anchor}')
    expect(output).toContain(':::tab{unlinked #anchor-two}')
    expect(output).toContain(':::div\n\nbare div body\n:::')
  })

  it('keeps deprecated syntax inside fenced code blocks, including nested fences and malformed fence markers', () => {
    const input = [
      '```md',
      '~~~',
      '~~`',
      '~~~',
      '!!! warning',
      '    still code',
      '```',
      '',
      '!!! note',
      '    converted',
    ].join('\n')

    const output = DeprecationCompute.convertDeprecatedSyntaxes(input)

    expect(output).toContain('!!! warning')
    expect(output).not.toContain(':::warning')
    expect(output).toContain(':::note')
    expect(output).toContain('converted')
  })

  it('dedents blank lines in nested content and only wraps real implicit frontmatter', () => {
    const converted = DeprecationCompute.convertDeprecatedSyntaxes(
      ['!!! note', '    first line', '', '    second line'].join('\n'),
    )
    const plain = DeprecationCompute.convertDeprecatedSyntaxes(
      ['', 'title: not frontmatter', 'paragraph'].join('\n'),
    )

    expect(converted).toContain('first line\n\nsecond line')
    expect(plain.startsWith('---\n')).toBe(false)
    expect(plain).toContain('\ntitle: not frontmatter\n')
  })
})
