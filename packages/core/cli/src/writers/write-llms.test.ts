import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'
import { PathHelpers } from '../helpers/path.js'
import { writeLlms } from './write-llms.js'

vi.mock('fs-extra', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(false as any),
    readFile: vi.fn(),
  },
}))

describe('writeLlms', () => {
  beforeEach(() => {
    vi.mocked(fs.writeFile).mockClear()
    vi.mocked(fs.pathExists)
      .mockReset()
      .mockResolvedValue(false as any)
    vi.mocked(fs.readFile).mockReset()
    ConfigCache.reset()
    ConfigCache.config = { build: { outDir: 'dist/docs' } } as any
  })

  it('writes reading and citation guidance in the configured output directory', async () => {
    await writeLlms({})

    expect(fs.writeFile).toHaveBeenCalledWith(
      PathHelpers.concat(ROOT_DIR, 'dist/docs/llms.txt'),
      expect.any(String),
      'utf8',
    )
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string
    expect(content).toContain('/_markee/llms.html')
    expect(content).toContain('retrieval_url links to Markdown')
    expect(content).toContain('canonical_url links for citations')
    expect(content).toContain(
      'Follow the retrieval_url links to read the documentation',
    )
    expect(content).toContain('canonical_url when citing a source')
    expect(content).not.toContain('/_markee/navigation.json')
    expect(content).not.toContain('"files" property')
    expect(content).toContain(
      "Resolve root-relative URLs against this site's origin",
    )
    expect(content).toContain(
      'links to other documentation pages are also absolute',
    )
    expect(content).toContain('URLs from the root of the site')
    expect(content).toMatch(/\n$/)
    expect(fs.writeFile).toHaveBeenCalledTimes(2)
  })

  it('lists every navigation file with escaped metadata and source links', async () => {
    const files = {
      '/docs/a&"<>\'.md': {
        link: '/docs/a?x="<>&\'',
        frontMatter: {
          title: 'Title & "<tag>" \'',
          description: 'Description <script> & "quotes"',
          excerpt: 'Unused excerpt',
        },
      },
      '/docs/untitled.md': {
        link: '/docs/untitled',
        frontMatter: { excerpt: 'Fallback excerpt' },
      },
      '/_markee/layout.md': {
        link: '',
        frontMatter: { title: 'Layout', excerpt: '' },
      },
    } as any

    await writeLlms(files)

    expect(fs.writeFile).toHaveBeenCalledWith(
      PathHelpers.concat(ROOT_DIR, 'dist/docs/_markee/llms.html'),
      expect.any(String),
      'utf8',
    )
    const content = vi.mocked(fs.writeFile).mock.calls[1][1] as string
    expect(content).toMatch(/^<!doctype html>\n<html lang="en">/)
    expect(content).toContain('<meta charset="utf-8">')
    expect(content).toContain('Follow the retrieval_url links')
    expect(content).toContain('Use the canonical_url when citing a page')
    expect(content).toContain(
      '<a href="/_markee/navigation.json">/_markee/navigation.json</a>',
    )
    expect(content.match(/<li>/g)).toHaveLength(Object.keys(files).length)
    expect(content).toContain(
      '<h2>Title &amp; &quot;&lt;tag&gt;&quot; &#39;</h2>',
    )
    expect(content).toContain(
      'canonical_url: <a href="/docs/a?x=&quot;&lt;&gt;&amp;&#39;">/docs/a?x=&quot;&lt;&gt;&amp;&#39;</a>',
    )
    expect(content).toContain(
      'Description &lt;script&gt; &amp; &quot;quotes&quot;',
    )
    expect(content).toContain('<a href="/docs/a&amp;&quot;&lt;&gt;&#39;.md">')
    expect(content).toContain('<h2>/docs/untitled.md</h2>')
    expect(content).toContain('<p>Fallback excerpt</p>')
    expect(content).toContain(
      'retrieval_url: <a href="/_markee/layout.md">/_markee/layout.md</a>',
    )
    expect(content).toContain(
      'canonical_url: Not available; retrieval-only resource. Do not cite.',
    )
    expect(content).not.toContain('<a href="">')
    expect(content).toContain(
      'Wrong citation: <code>/docs/a&amp;&quot;&lt;&gt;&#39;.md</code>',
    )
    expect(content).toContain(
      'Correct citation: <code>/docs/a?x=&quot;&lt;&gt;&amp;&#39;</code>',
    )
    expect(content).not.toContain('Unused excerpt')
    expect(content).not.toMatch(/<script|<style/)
    expect(content).toMatch(/<\/html>\n$/)
  })

  it('puts citation constraints and a real document example before discovery instructions in both formats', async () => {
    await writeLlms({
      '/_assets/header.md': { link: '', frontMatter: { excerpt: '' } },
      '/_markee/hidden.md': {
        link: '/hidden',
        frontMatter: { excerpt: '', hidden: true },
      },
      '/_markee/draft.md': {
        link: '/draft',
        frontMatter: { excerpt: '', draft: true },
      },
      '/_markee/start.md': {
        link: '/guide/start',
        frontMatter: { excerpt: '' },
      },
      '/_markee/next.md': { link: '/guide/next', frontMatter: { excerpt: '' } },
    } as any)

    for (const [, content] of vi.mocked(fs.writeFile).mock.calls) {
      const guidance = content as string
      expect(guidance).toContain(
        'NEVER expose, cite, or link a /_markee/ URL in user-facing answers',
      )
      expect(guidance).toContain("NEVER cite a document's retrieval_url")
      expect(guidance).toContain('ALWAYS use its corresponding canonical_url')
      expect(guidance).toContain('Copy the supplied canonical_url')
      expect(guidance).toContain('Wrong citation:')
      expect(guidance).toContain('Correct citation:')
      expect(guidance).toContain(
        'Before producing your final response, inspect every URL',
      )
      expect(guidance).toContain('No user-visible URL may contain /_markee/')
    }
    const text = vi.mocked(fs.writeFile).mock.calls[0][1] as string
    expect(text.indexOf('Citation requirements')).toBeLessThan(
      text.indexOf('/_markee/llms.html'),
    )
    expect(text).toContain('Wrong citation: /_markee/start.md')
    expect(text).toContain('Correct citation: /guide/start')
    expect(text).not.toContain('Wrong citation: /_markee/next.md')
    const html = vi.mocked(fs.writeFile).mock.calls[1][1] as string
    expect(html.indexOf('Citation requirements')).toBeLessThan(
      html.indexOf('<ul>'),
    )
    expect(html).toContain('Wrong citation: <code>/_markee/start.md</code>')
    expect(html).toContain('Correct citation: <code>/guide/start</code>')
  })

  it.each([{}, { '/layout.md': { link: '', frontMatter: { excerpt: '' } } }])(
    'omits citation examples when the first indexed file has no canonical URL',
    async (files) => {
      await writeLlms(files as any)

      for (const [, content] of vi.mocked(fs.writeFile).mock.calls) {
        expect(content).not.toContain('Wrong citation:')
        expect(content).not.toContain('Correct citation:')
        expect(content).toContain('Citation requirements')
      }
    },
  )

  it('omits asset files while preserving similarly named documentation paths', async () => {
    const files = {
      '/_assets/header.md': {
        link: '',
        frontMatter: { title: 'Private header', excerpt: '' },
      },
      '/_assets/_extension/theme/layout.md': {
        link: '',
        frontMatter: { title: 'Private layout', excerpt: '' },
      },
      '/_assets-guide.md': {
        link: '/assets-guide',
        frontMatter: { title: 'Public guide', excerpt: '' },
      },
    } as any

    await writeLlms(files)

    const content = vi.mocked(fs.writeFile).mock.calls[1][1] as string
    expect(content.match(/<li>/g)).toHaveLength(1)
    expect(content).toContain('<a href="/_assets-guide.md">')
    expect(content).not.toContain('/_assets/header.md')
    expect(content).not.toContain('/_assets/_extension/theme/layout.md')
    expect(content).not.toContain('Private header')
    expect(content).not.toContain('Private layout')
  })

  it('prepends generated guidance to the existing output llms.txt with a separator', async () => {
    const custom = '# Custom instructions\n\nUse our support portal.\n'
    vi.mocked(fs.pathExists).mockResolvedValue(true as any)
    vi.mocked(fs.readFile).mockResolvedValue(custom as any)

    await writeLlms({})

    const path = PathHelpers.concat(ROOT_DIR, 'dist/docs/llms.txt')
    expect(fs.pathExists).toHaveBeenCalledWith(path)
    expect(fs.readFile).toHaveBeenCalledWith(path, 'utf8')
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string
    expect(content).toMatch(/^# Citation requirements/)
    expect(content).toContain('/_markee/llms.html')
    expect(content).toContain(`\n\n---\n\n${custom}`)
    expect(content.endsWith(custom)).toBe(true)
    expect(fs.writeFile).not.toHaveBeenCalledWith(
      expect.stringContaining('/_markee/llms.txt'),
      expect.anything(),
      expect.anything(),
    )
  })

  it('does not add a separator for an empty custom file', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true as any)
    vi.mocked(fs.readFile).mockResolvedValue('' as any)

    await writeLlms({})

    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string
    expect(content).not.toContain('\n---\n')
  })

  it('fails instead of overwriting a custom file it cannot read', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true as any)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('read failed'))

    await expect(writeLlms({})).rejects.toThrow('read failed')
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  it('excludes hidden files and drafts without changing the navigation map', async () => {
    const files = {
      '/docs/public.md': {
        link: '/docs/public',
        frontMatter: {
          title: 'Public page',
          excerpt: '',
          hidden: false,
          draft: false,
        },
      },
      '/docs/unflagged.md': {
        link: '/docs/unflagged',
        frontMatter: { title: 'Unflagged page', excerpt: '' },
      },
      '/docs/hidden.md': {
        link: '/docs/hidden',
        frontMatter: { title: 'Hidden page', excerpt: '', hidden: true },
      },
      '/docs/draft.md': {
        link: '/docs/draft',
        frontMatter: { title: 'Draft page', excerpt: '', draft: true },
      },
      '/docs/hidden-draft.md': {
        link: '/docs/hidden-draft',
        frontMatter: {
          title: 'Hidden draft page',
          excerpt: '',
          hidden: true,
          draft: true,
        },
      },
    } as any
    const original = structuredClone(files)

    await writeLlms(files)

    const content = vi.mocked(fs.writeFile).mock.calls[1][1] as string
    expect(content.match(/<li>/g)).toHaveLength(2)
    expect(content).toContain('<a href="/docs/public.md">')
    expect(content).toContain('<a href="/docs/unflagged.md">')
    for (const name of ['hidden', 'draft', 'hidden-draft']) {
      expect(content).not.toContain(`/docs/${name}`)
      expect(content).not.toContain(files[`/docs/${name}.md`].frontMatter.title)
    }
    expect(files).toEqual(original)
  })

  it('propagates write failures so the build cannot silently omit the guidance', async () => {
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('write failed'))

    await expect(writeLlms({})).rejects.toThrow('write failed')
  })
})
