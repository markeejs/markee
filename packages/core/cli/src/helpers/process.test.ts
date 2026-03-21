import { afterEach, describe, expect, it, vi } from 'vitest'

async function importProcess({
  execFile = vi.fn(),
  execFileSync = vi.fn(),
  bun,
}: {
  execFile?: ReturnType<typeof vi.fn>
  execFileSync?: ReturnType<typeof vi.fn>
  bun?: unknown
} = {}) {
  vi.resetModules()
  vi.unstubAllGlobals()

  vi.doMock('node:child_process', () => ({
    execFile,
    execFileSync,
  }))

  if (bun) vi.stubGlobal('Bun', bun)

  return {
    ...(await import('./process.js')),
    mocks: { execFile, execFileSync },
  }
}

describe('ProcessHelpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses node execFile for async processes', async () => {
    const execFile = vi.fn(
      (
        file: string,
        args: string[],
        options: { cwd?: string },
        callback: (error: null, stdout: string, stderr: string) => void,
      ) => {
        expect(file).toBe('git')
        expect(args).toEqual(['status'])
        expect(options).toEqual({ cwd: '/repo', encoding: 'utf8' })
        callback(null, 'ok', '')
      },
    )

    const { ProcessHelpers } = await importProcess({ execFile })

    await expect(
      ProcessHelpers.execFile('git', ['status'], { cwd: '/repo' }),
    ).resolves.toEqual({
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
    })
  })

  it('normalizes node execFile failures', async () => {
    const execFile = vi.fn(
      (
        _file: string,
        _args: string[],
        _options: { cwd?: string },
        callback: (
          error: Error & { code: number },
          stdout: string,
          stderr: string,
        ) => void,
      ) => {
        callback(
          Object.assign(new Error('boom'), { code: 3 }),
          'partial',
          'nope',
        )
      },
    )

    const { ProcessHelpers } = await importProcess({ execFile })

    await expect(
      ProcessHelpers.execFile('git', ['status']),
    ).rejects.toMatchObject({
      stdout: 'partial',
      stderr: 'nope',
      exitCode: 3,
      command: ['git', 'status'],
    })
  })

  it('falls back to exit code 1 for node execFile errors without a numeric code', async () => {
    const execFile = vi.fn(
      (
        _file: string,
        _args: string[],
        _options: { cwd?: string },
        callback: (error: Error & { code: string }) => void,
      ) => {
        callback(Object.assign(new Error('missing'), { code: 'ENOENT' }))
      },
    )
    const { ProcessHelpers } = await importProcess({ execFile })

    await expect(
      ProcessHelpers.execFile('git', ['status']),
    ).rejects.toMatchObject({
      stdout: '',
      stderr: '',
      exitCode: 1,
      command: ['git', 'status'],
    })
  })

  it('accepts configured non-zero exit codes for node async processes', async () => {
    const execFile = vi.fn(
      (
        _file: string,
        _args: string[],
        _options: { cwd?: string },
        callback: (
          error: Error & { code: number },
          stdout: string,
          stderr: string,
        ) => void,
      ) => {
        callback(Object.assign(new Error('copied'), { code: 3 }), 'ok', '')
      },
    )
    const { ProcessHelpers } = await importProcess({ execFile })

    await expect(
      ProcessHelpers.execFile('robocopy', ['src', 'dest'], {
        acceptExitCode: (code) => code < 8,
      }),
    ).resolves.toEqual({
      stdout: 'ok',
      stderr: '',
      exitCode: 3,
    })
  })

  it('uses node execFileSync for sync processes', async () => {
    const execFileSync = vi.fn().mockReturnValue('root\n')
    const { ProcessHelpers, mocks } = await importProcess({ execFileSync })

    expect(
      ProcessHelpers.execFileSync('git', ['rev-parse'], {
        cwd: '/repo',
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'ignore',
      }),
    ).toEqual({
      stdout: 'root\n',
      stderr: '',
      exitCode: 0,
    })

    expect(mocks.execFileSync).toHaveBeenCalledWith('git', ['rev-parse'], {
      cwd: '/repo',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  })

  it('normalizes node execFileSync failures', async () => {
    const execFileSync = vi.fn().mockImplementation(() => {
      throw Object.assign(new Error('boom'), {
        status: 2,
        stdout: Buffer.from('partial'),
        stderr: Buffer.from('failed'),
      })
    })
    const { ProcessHelpers } = await importProcess({ execFileSync })

    expect(() =>
      ProcessHelpers.execFileSync('git', ['rev-parse']),
    ).toThrowError(
      expect.objectContaining({
        stdout: 'partial',
        stderr: 'failed',
        exitCode: 2,
        command: ['git', 'rev-parse'],
      }),
    )
  })

  it('uses Bun.spawn for async processes when Bun is available', async () => {
    const spawn = vi.fn().mockReturnValue({
      stdout: new Response('bun stdout').body,
      stderr: new Response('').body,
      exited: Promise.resolve(0),
    })
    const { ProcessHelpers } = await importProcess({
      bun: { spawn },
    })

    await expect(ProcessHelpers.execFile('git', ['status'])).resolves.toEqual({
      stdout: 'bun stdout',
      stderr: '',
      exitCode: 0,
    })
    expect(spawn).toHaveBeenCalledWith(['git', 'status'], {})
  })

  it('uses Bun.spawnSync for successful sync processes when Bun is available', async () => {
    const spawnSync = vi.fn().mockReturnValue({
      stdout: 'bun sync',
      stderr: '',
      exitCode: 0,
    })
    const { ProcessHelpers } = await importProcess({
      bun: { spawnSync },
    })

    expect(ProcessHelpers.execFileSync('git', ['rev-parse'])).toEqual({
      stdout: 'bun sync',
      stderr: '',
      exitCode: 0,
    })
  })

  it('normalizes Bun failures for async and sync processes', async () => {
    const spawn = vi.fn().mockReturnValue({
      stdout: new Response('').body,
      stderr: new Response('bun failed').body,
      exited: Promise.resolve(4),
    })
    const spawnSync = vi.fn().mockReturnValue({
      stdout: new Uint8Array(),
      stderr: new TextEncoder().encode('sync failed'),
      exitCode: 5,
    })
    const { ProcessHelpers } = await importProcess({
      bun: { spawn, spawnSync },
    })

    await expect(
      ProcessHelpers.execFile('git', ['status']),
    ).rejects.toMatchObject({
      stderr: 'bun failed',
      exitCode: 4,
      command: ['git', 'status'],
    })

    expect(() =>
      ProcessHelpers.execFileSync('git', ['rev-parse']),
    ).toThrowError(
      expect.objectContaining({
        stderr: 'sync failed',
        exitCode: 5,
        command: ['git', 'rev-parse'],
      }),
    )
  })

  it('uses a fallback Bun error message when no stderr stream is available', async () => {
    const spawn = vi.fn().mockReturnValue({
      stdout: null,
      stderr: null,
      exited: Promise.resolve(6),
    })
    const { ProcessHelpers } = await importProcess({
      bun: { spawn },
    })

    await expect(
      ProcessHelpers.execFile('git', ['status']),
    ).rejects.toMatchObject({
      message: 'git exited with status code 6',
      stdout: '',
      stderr: '',
      exitCode: 6,
    })
  })

  it('falls back to exit code 1 for node execFileSync errors without a numeric status', async () => {
    const execFileSync = vi.fn().mockImplementation(() => {
      throw new Error('boom')
    })
    const { ProcessHelpers } = await importProcess({ execFileSync })

    expect(() =>
      ProcessHelpers.execFileSync('git', ['rev-parse']),
    ).toThrowError(
      expect.objectContaining({
        stdout: '',
        stderr: '',
        exitCode: 1,
        command: ['git', 'rev-parse'],
      }),
    )
  })

  it('accepts configured non-zero exit codes for node sync processes', async () => {
    const execFileSync = vi.fn().mockImplementation(() => {
      throw Object.assign(new Error('copied'), {
        status: 3,
        stdout: 'ok',
        stderr: '',
      })
    })
    const { ProcessHelpers } = await importProcess({ execFileSync })

    expect(
      ProcessHelpers.execFileSync('robocopy', ['src', 'dest'], {
        acceptExitCode: (code) => code < 8,
      }),
    ).toEqual({
      stdout: 'ok',
      stderr: '',
      exitCode: 3,
    })
  })
})
