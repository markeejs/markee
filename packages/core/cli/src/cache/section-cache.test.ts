import { describe, expect, it, vi } from 'vitest'

async function importSectionCache(
  navigationStructure: ReturnType<typeof vi.fn>,
) {
  vi.resetModules()
  vi.doMock('../compute/section.js', () => ({
    SectionCompute: {
      navigationStructure,
    },
  }))

  return await import('./section-cache.js')
}

describe('SectionCache', () => {
  it('delegates folder loading to SectionCompute', async () => {
    const navigationStructure = vi.fn().mockResolvedValue({ '/': {} })
    const { SectionCache } = await importSectionCache(navigationStructure)
    const files = { '/docs/page.md': {} } as any

    await expect(SectionCache.loadFolders(files)).resolves.toEqual({ '/': {} })
    expect(navigationStructure).toHaveBeenCalledWith(files)
  })

  it('accepts file clear calls as a no-op', async () => {
    const { SectionCache } = await importSectionCache(vi.fn())

    expect(SectionCache.clearFile('/docs/page.md')).toBeUndefined()
  })
})
