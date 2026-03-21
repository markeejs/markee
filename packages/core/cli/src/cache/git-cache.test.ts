import { describe, expect, it, vi } from 'vitest'

async function importGitCache({
  execFileSync = vi.fn(),
  execFile = vi.fn(),
  stat = vi.fn(),
}: {
  execFileSync?: ReturnType<typeof vi.fn>
  execFile?: ReturnType<typeof vi.fn>
  stat?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()

  vi.doMock('../helpers/process.js', () => ({
    ProcessHelpers: {
      execFileSync,
      execFile,
    },
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
    mocks: { execFileSync, execFile, stat },
  }
}

describe('GitCache', () => {
  it('prefers git revision dates when available', async () => {
    const execFileSync = vi.fn().mockReturnValue({ stdout: '/repo\n' })
    const execFile = vi.fn().mockResolvedValue({
      stdout: [
        'Fri Mar 01 2024',
        'docs/page.md',
        'Fri Feb 01 2024',
        'docs/page.md',
      ].join('\n'),
    })
    const { GitCache, mocks } = await importGitCache({
      execFileSync,
      execFile,
      stat: vi.fn(),
    })

    await expect(GitCache.getRevisionDate('/docs/page.md')).resolves.toBe(
      new Date('Fri Mar 01 2024').valueOf(),
    )
    expect(mocks.stat).not.toHaveBeenCalled()
    expect(mocks.execFileSync).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      expect.objectContaining({ cwd: '/repo', stderr: 'ignore' }),
    )
    expect(mocks.execFile).toHaveBeenCalledWith(
      'git',
      ['log', '--name-only', '--date=default', '--pretty=format:%ad', '*.md'],
      { cwd: '/repo' },
    )
  })

  it('falls back to file mtimes when git is unavailable or missing the file', async () => {
    const execFileSync = vi.fn().mockImplementation(() => {
      throw new Error('no git')
    })
    const execFile = vi.fn().mockRejectedValue(new Error('git log failed'))
    const stat = vi
      .fn()
      .mockResolvedValueOnce({ mtimeMs: 1234 })
      .mockRejectedValueOnce(new Error('missing'))
    const { GitCache } = await importGitCache({ execFileSync, execFile, stat })

    await expect(GitCache.getRevisionDate('/docs/page.md')).resolves.toBe(1234)
    await expect(GitCache.getRevisionDate('/docs/missing.md')).resolves.toBe(0)
  })
})
