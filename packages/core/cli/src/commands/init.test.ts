import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type PromptResponse = string | { value: string }

const originalStdinIsTTY = process.stdin.isTTY
const originalStdoutIsTTY = process.stdout.isTTY

function setTty(stdin: boolean, stdout: boolean) {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value: stdin,
  })
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: stdout,
  })
}

async function importCommandInit({
  responses = [],
  existingConfigs = {},
  readJson = vi.fn(),
  userAgent,
  packageJsonExists = true,
}: {
  responses?: PromptResponse[]
  existingConfigs?: Record<string, boolean>
  readJson?: ReturnType<typeof vi.fn>
  userAgent?: string
  packageJsonExists?: boolean
} = {}) {
  vi.resetModules()

  const prompt = vi.fn(async () => {
    const next = responses.shift()
    return typeof next === 'string' ? { value: next } : next
  })
  const pathExists = vi.fn(async (file: string) => {
    const normalized = file.replaceAll('\\', '/')
    if (normalized.endsWith('/package.json')) return packageJsonExists
    const name = normalized.split('/').at(-1) as string
    return existingConfigs[name] ?? false
  })
  const writeFile = vi.fn().mockResolvedValue(undefined)
  const stringify = vi.fn((value: unknown) => JSON.stringify(value, null, 2))

  vi.doMock('enquirer', () => ({
    default: class {
      prompt = prompt
    },
  }))
  vi.doMock('fs-extra', () => ({
    default: {
      pathExists,
      readJSON: readJson,
      writeFile,
    },
  }))
  vi.doMock('yaml', () => ({
    default: {
      stringify,
    },
  }))
  vi.doMock('../constants.js', () => ({
    ROOT_DIR: '/project',
  }))

  if (userAgent !== undefined) {
    vi.stubEnv('npm_config_user_agent', userAgent)
  } else {
    delete process.env.npm_config_user_agent
  }

  return {
    ...(await import('./init.js')),
    mocks: { prompt, pathExists, readJson, writeFile, stringify },
  }
}

describe('commandInit', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'clear').mockImplementation(() => {})
    setTty(true, true)
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: originalStdinIsTTY,
    })
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: originalStdoutIsTTY,
    })
    vi.unstubAllEnvs()
  })

  it('aborts when a config file already exists', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`exit:${code}`)
    }) as any)
    const { commandInit } = await importCommandInit({
      existingConfigs: { 'markee.yml': true },
    })

    await expect(commandInit()).rejects.toThrow('exit:1')
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('markee.yml already exists'),
    )
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('aborts when the terminal is not interactive', async () => {
    setTty(false, true)
    const exit = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`exit:${code}`)
    }) as any)
    const { commandInit } = await importCommandInit()

    await expect(commandInit()).rejects.toThrow('exit:1')
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      'init requires an interactive terminal.',
    )
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('walks through title, add, edit, delete, and generate with an existing package.json', async () => {
    const readJson = vi.fn(async (file: string) => {
      if (file.endsWith('/packages/core/cli/package.json')) {
        return { version: '1.2.3' }
      }

      return {
        devDependencies: {
          '@markee/cli': '^0.0.1',
        },
        dependencies: {
          react: '^19.0.0',
        },
      }
    })
    const responses: PromptResponse[] = [
      '0',
      '  Café docs  ',
      '1',
      '',
      ' guides ',
      ' docs ',
      ' docs-layout ',
      '2',
      '0',
      '',
      '-',
      '-',
      '1',
      'blog',
      '',
      '',
      '3',
      '1',
      '4',
    ]
    const { commandInit, mocks } = await importCommandInit({
      responses,
      readJson,
      userAgent: 'pnpm/9.0.0',
    })

    await commandInit()

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Please enter a value.'),
    )
    expect(mocks.writeFile).toHaveBeenNthCalledWith(
      1,
      '/project/package.json',
      `${JSON.stringify(
        {
          dependencies: {
            'react': '^19.0.0',
            '@markee/cli': '^1.2.3',
          },
          name: 'cafe-docs',
        },
        null,
        2,
      )}\n`,
    )
    expect(mocks.stringify).toHaveBeenCalledWith({
      title: 'Café docs',
      sources: [{ root: 'guides' }],
    })
    expect(mocks.writeFile).toHaveBeenNthCalledWith(
      2,
      '/project/markee.yaml',
      JSON.stringify(
        {
          title: 'Café docs',
          sources: [{ root: 'guides' }],
        },
        null,
        2,
      ),
    )
    expect(console.clear).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Run'))
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Generated package.json and markee.yaml'),
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('pnpm install'),
    )
  })

  it.each([
    ['yarn/4.0.0', 'yarn install'],
    ['bun/1.0.0', 'bun install'],
    [undefined, 'npm install'],
  ])(
    'chooses the right install command for %s',
    async (userAgent, expected) => {
      const readJson = vi.fn(async (file: string) =>
        file.endsWith('/packages/core/cli/package.json')
          ? { version: '2.0.0' }
          : {},
      )
      const { commandInit } = await importCommandInit({
        responses: ['2'],
        readJson,
        userAgent,
      })

      await commandInit()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(expected),
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Generated package.json and markee.yaml'),
      )
    },
  )

  it('creates a fresh package.json when none exists yet', async () => {
    const readJson = vi.fn(async () => ({ version: '3.0.0' }))
    const { commandInit, mocks } = await importCommandInit({
      responses: ['2'],
      readJson,
      packageJsonExists: false,
    })

    await commandInit()

    expect(mocks.writeFile).toHaveBeenNthCalledWith(
      1,
      '/project/package.json',
      `${JSON.stringify(
        {
          name: 'markee-site',
          dependencies: {
            '@markee/cli': '^3.0.0',
          },
        },
        null,
        2,
      )}\n`,
    )
  })

  it('falls back to the default slug and omits empty title, mount, and layout fields', async () => {
    const readJson = vi.fn(async (file: string) =>
      file.endsWith('/packages/core/cli/package.json')
        ? { version: '4.0.0' }
        : {},
    )
    const { commandInit, mocks } = await importCommandInit({
      responses: ['0', '!!!', '1', 'docs', '', '', '4'],
      readJson,
      packageJsonExists: false,
    })

    await commandInit()

    expect(mocks.writeFile).toHaveBeenNthCalledWith(
      1,
      '/project/package.json',
      `${JSON.stringify(
        {
          name: 'markee-project',
          dependencies: {
            '@markee/cli': '^4.0.0',
          },
        },
        null,
        2,
      )}\n`,
    )
    expect(mocks.stringify).toHaveBeenCalledWith({
      title: '!!!',
      sources: [{ root: 'docs' }],
    })
  })

  it('keeps mount and layout on configured sources when using the default title', async () => {
    const readJson = vi.fn(async (file: string) =>
      file.endsWith('/packages/core/cli/package.json')
        ? { version: '5.0.0' }
        : {},
    )
    const { commandInit, mocks } = await importCommandInit({
      responses: ['1', 'docs', 'manual', 'docs-layout', '4'],
      readJson,
      packageJsonExists: false,
    })

    await commandInit()

    expect(mocks.stringify).toHaveBeenCalledWith({
      title: 'Markee Site',
      sources: [
        {
          root: 'docs',
          mount: 'manual',
          layout: 'docs-layout',
        },
      ],
    })
  })
})
