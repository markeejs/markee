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
    await writeLlms()

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
    expect(fs.writeFile).toHaveBeenCalledTimes(1)
  })

  it('propagates write failures so the build cannot silently omit the guidance', async () => {
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('write failed'))

    await expect(writeLlms()).rejects.toThrow('write failed')
  })
})
