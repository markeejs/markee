import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_USER_AGENT = process.env.npm_config_user_agent

async function importBin({
  userAgent,
  runtime,
  bun = false,
  spawnSync = vi.fn(),
}: {
  userAgent?: string | null
  runtime?: string
  bun?: boolean
  spawnSync?: ReturnType<typeof vi.fn>
} = {}) {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()

  const loaded = vi.fn()

  vi.doMock('node:child_process', () => ({
    spawnSync,
  }))
  vi.doMock('./dist/index.js', () => {
    loaded()
    return {}
  })

  if (userAgent === null) {
    delete process.env.npm_config_user_agent
  } else if (userAgent) {
    vi.stubEnv('npm_config_user_agent', userAgent)
  }
  if (runtime) vi.stubEnv('MARKEE_RUNTIME', runtime)
  if (bun) vi.stubGlobal('Bun', {})

  return {
    loaded,
    spawnSync,
    // @ts-ignore - bin entry is plain JS
    importPromise: import('./bin.js'),
  }
}

describe('bin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    if (ORIGINAL_USER_AGENT === undefined) {
      delete process.env.npm_config_user_agent
    } else {
      process.env.npm_config_user_agent = ORIGINAL_USER_AGENT
    }
  })

  it('loads the built CLI entrypoint', async () => {
    const { loaded, spawnSync, importPromise } = await importBin({
      userAgent: null,
    })

    await importPromise

    expect(loaded).toHaveBeenCalledTimes(1)
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it('re-execs through Bun when launched from a Bun package-manager context', async () => {
    const spawnSync = vi.fn().mockReturnValue({ status: 0 })
    const exit = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`exit:${code ?? 0}`)
    }) as never)
    const { loaded, importPromise } = await importBin({
      userAgent: 'bun/1.2.2',
      spawnSync,
    })

    await expect(importPromise).rejects.toThrow('exit:0')

    expect(loaded).not.toHaveBeenCalled()
    expect(spawnSync).toHaveBeenCalledWith(
      'bun',
      [expect.stringContaining('/dist/index.js')],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({
          MARKEE_RUNTIME_REEXEC: '1',
          npm_config_user_agent: 'bun/1.2.2',
        }),
      }),
    )
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('re-execs through Node when explicitly requested from Bun', async () => {
    const spawnSync = vi.fn().mockReturnValue({ status: 0 })
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`)
    }) as never)
    const { loaded, importPromise } = await importBin({
      runtime: 'node',
      bun: true,
      spawnSync,
    })

    await expect(importPromise).rejects.toThrow('exit:0')

    expect(loaded).not.toHaveBeenCalled()
    expect(spawnSync).toHaveBeenCalledWith(
      'node',
      [expect.stringContaining('/dist/index.js')],
      expect.objectContaining({
        env: expect.objectContaining({
          MARKEE_RUNTIME: 'node',
          MARKEE_RUNTIME_REEXEC: '1',
        }),
      }),
    )
  })

  it('surfaces runtime re-exec spawn errors', async () => {
    const { importPromise } = await importBin({
      userAgent: 'bun/1.2.2',
      spawnSync: vi.fn().mockReturnValue({ error: new Error('missing bun') }),
    })

    await expect(importPromise).rejects.toThrow('missing bun')
  })

  it('supports an explicit Bun runtime override without relying on the user agent', async () => {
    const spawnSync = vi.fn().mockReturnValue({})
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 1}`)
    }) as never)
    const { loaded, importPromise } = await importBin({
      runtime: 'bun',
      spawnSync,
    })

    await expect(importPromise).rejects.toThrow('exit:1')

    expect(loaded).not.toHaveBeenCalled()
    expect(spawnSync).toHaveBeenCalledWith(
      'bun',
      [expect.stringContaining('/dist/index.js')],
      expect.objectContaining({
        env: expect.objectContaining({
          MARKEE_RUNTIME: 'bun',
          MARKEE_RUNTIME_REEXEC: '1',
        }),
      }),
    )
  })
})
