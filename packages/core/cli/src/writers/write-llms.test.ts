import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'
import { PathHelpers } from '../helpers/path.js'
import { writeLlms } from './write-llms.js'

vi.mock('fs-extra', () => ({
  default: { writeFile: vi.fn().mockResolvedValue(undefined) },
}))

describe('writeLlms', () => {
  beforeEach(() => {
    vi.mocked(fs.writeFile).mockClear()
    ConfigCache.reset()
    ConfigCache.config = { build: { outDir: 'dist/docs' } } as any
  })

  it('writes reading and citation guidance in the configured output directory', async () => {
    await writeLlms({})

    expect(fs.writeFile).toHaveBeenCalledWith(
      PathHelpers.concat(ROOT_DIR, 'dist/docs/_markee/llms.txt'),
      expect.any(String),
      'utf8',
    )
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string
    expect(content).toContain('/_markee/navigation.json')
    expect(content).toContain('"files" property is a map')
    expect(content).toContain('Each key is the URL of a served Markdown file')
    expect(content).toContain('"link" property with the canonical URL')
    expect(content).toContain('Use this URL when citing a source')
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
    expect(content).toContain('Follow the Markdown source links')
    expect(content).toContain(
      'Use the canonical human-facing URL when citing a page',
    )
    expect(content).toContain(
      '<a href="/_markee/navigation.json">/_markee/navigation.json</a>',
    )
    expect(content.match(/<li>/g)).toHaveLength(Object.keys(files).length)
    expect(content).toContain(
      '<h2>Title &amp; &quot;&lt;tag&gt;&quot; &#39;</h2>',
    )
    expect(content).toContain(
      'Canonical URL for citations: <a href="/docs/a?x=&quot;&lt;&gt;&amp;&#39;">/docs/a?x=&quot;&lt;&gt;&amp;&#39;</a>',
    )
    expect(content).toContain(
      'Description &lt;script&gt; &amp; &quot;quotes&quot;',
    )
    expect(content).toContain('<a href="/docs/a&amp;&quot;&lt;&gt;&#39;.md">')
    expect(content).toContain('<h2>/docs/untitled.md</h2>')
    expect(content).toContain('<p>Fallback excerpt</p>')
    expect(content).toContain('<a href="/_markee/layout.md">')
    expect(content).not.toContain('Unused excerpt')
    expect(content).not.toMatch(/<script|<style/)
    expect(content).toMatch(/<\/html>\n$/)
  })

  it('propagates write failures so the build cannot silently omit the guidance', async () => {
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('write failed'))

    await expect(writeLlms({})).rejects.toThrow('write failed')
  })
})
