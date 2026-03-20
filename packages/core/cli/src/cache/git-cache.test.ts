import { describe, expect, it, vi } from 'vitest'

async function importGitCache({
  execSync = vi.fn(),
  exec = vi.fn(),
  stat = vi.fn(),
}: {
  execSync?: ReturnType<typeof vi.fn>
  exec?: ReturnType<typeof vi.fn>
  stat?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  vi.doMock('child_process', () => ({
    execSync,
    exec,
  }))
  vi.doMock('fs-extra', () => ({
    default: {
      stat,
    },
  }))
  vi.doMock('../constants.js', () => ({
    ROOT_DIR: '/repo',
  }))

  return {
    ...(await import('./git-cache.js')),
    mocks: { execSync, exec, stat },
  }
}

describe('GitCache', () => {
  it('prefers git revision dates when available', async () => {
    const execSync = vi.fn().mockReturnValue(Buffer.from('/repo\n'))
    const exec = vi.fn((_: string, cb: (error: null, stdout: string) => void) =>
      cb(
        null,
        [
          'Fri Mar 01 2024',
          'docs/page.md',
          'Fri Feb 01 2024',
          'docs/page.md',
        ].join('\n'),
      ),
    )
    const { GitCache, mocks } = await importGitCache({
      execSync,
      exec,
      stat: vi.fn(),
    })

    await expect(GitCache.getRevisionDate('/docs/page.md')).resolves.toBe(
      new Date('Fri Mar 01 2024').valueOf(),
    )
    expect(mocks.stat).not.toHaveBeenCalled()
  })

  it('falls back to file mtimes when git is unavailable or missing the file', async () => {
    const execSync = vi.fn().mockImplementation(() => {
      throw new Error('no git')
    })
    const exec = vi.fn((_: string, cb: (error: Error) => void) =>
      cb(new Error('git log failed')),
    )
    const stat = vi
      .fn()
      .mockResolvedValueOnce({ mtimeMs: 1234 })
      .mockRejectedValueOnce(new Error('missing'))
    const { GitCache } = await importGitCache({ execSync, exec, stat })

    await expect(GitCache.getRevisionDate('/docs/page.md')).resolves.toBe(1234)
    await expect(GitCache.getRevisionDate('/docs/missing.md')).resolves.toBe(0)
  })
})
