import { beforeEach, describe, expect, it, vi } from 'vitest'

let baseLog: ReturnType<typeof vi.fn>

async function importCli(options: Record<string, unknown>) {
  vi.resetModules()

  const commandLineArgs = vi.fn(() => options)
  const commandLineUsage = vi.fn(() => 'USAGE')
  const loadConfig = vi.fn().mockResolvedValue(undefined)
  const commandDev = vi.fn().mockResolvedValue(undefined)
  const commandBuild = vi.fn().mockResolvedValue(undefined)
  const commandInit = vi.fn().mockResolvedValue(undefined)
  const commandServe = vi.fn().mockResolvedValue(undefined)
  const getPrefix = vi.fn(() => '[prefix]')

  vi.doMock('command-line-args', () => ({
    default: commandLineArgs,
  }))
  vi.doMock('command-line-usage', () => ({
    default: commandLineUsage,
  }))
  vi.doMock('./constants.js', () => ({
    ROOT_DIR: '/project',
    MARKEE: 'Markee',
    MARKEE_PREFIX: {
      get: getPrefix,
    },
  }))
  vi.doMock('./cache/config-cache.js', () => ({
    ConfigCache: {
      loadConfig,
    },
  }))
  vi.doMock('./commands/dev.js', () => ({
    commandDev,
  }))
  vi.doMock('./commands/build.js', () => ({
    commandBuild,
  }))
  vi.doMock('./commands/init.js', () => ({
    commandInit,
  }))
  vi.doMock('./commands/serve.js', () => ({
    commandServe,
  }))

  return {
    ...(await import('./index.js').catch((error) => ({ error }))),
    mocks: {
      commandLineArgs,
      commandLineUsage,
      loadConfig,
      commandDev,
      commandBuild,
      commandInit,
      commandServe,
      getPrefix,
    },
  }
}

describe('cli entrypoint', () => {
  beforeEach(() => {
    baseLog = vi.fn()
    vi.spyOn(console, 'log').mockImplementation(baseLog)
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  it('prints usage and exits for help or missing commands', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`exit:${code}`)
    }) as any)

    const helpRun = await importCli({ help: true })
    expect(helpRun.error).toBeInstanceOf(Error)
    expect((helpRun.error as Error).message).toBe('exit:0')
    expect(console.log).toHaveBeenCalledWith('USAGE')

    const missingRun = await importCli({})
    expect((missingRun.error as Error).message).toBe('exit:0')
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('aliases development commands, loads config, and executes the dev command', async () => {
    const { mocks } = await importCli({
      command: 'start',
      mode: 'production',
    })

    expect(global.command).toBe('develop')
    expect(global.mode).toBe('preview')
    expect(mocks.loadConfig).toHaveBeenCalledWith('/project', {
      command: 'start',
      mode: 'production',
    })
    expect(mocks.commandDev).toHaveBeenCalledTimes(1)
    expect(mocks.commandBuild).not.toHaveBeenCalled()
    expect(process.stdout.write).toHaveBeenCalledWith('[prefix]')
    expect(baseLog).toHaveBeenCalledWith('Markee', 'starting up...')
    expect(baseLog).toHaveBeenCalledWith('Entering', expect.any(String), 'mode')
  })

  it('keeps init unprefixed and executes the init command', async () => {
    const originalLog = console.log
    const { mocks } = await importCli({
      command: 'init',
      mode: 'preview',
    })

    expect(global.command).toBe('init')
    expect(global.mode).toBe('preview')
    expect(console.log).toBe(originalLog)
    expect(mocks.commandInit).toHaveBeenCalledTimes(1)
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('fails on unknown commands after printing usage', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`exit:${code}`)
    }) as any)

    const { error, mocks } = await importCli({
      command: 'unknown',
      mode: 'preview',
    })

    expect((error as Error).message).toBe('exit:1')
    expect(mocks.loadConfig).toHaveBeenCalledTimes(1)
    expect(baseLog).toHaveBeenCalledWith(
      expect.any(String),
      'unknown command. Use --help to see available commands.',
    )
    expect(baseLog).toHaveBeenCalledWith('USAGE')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
