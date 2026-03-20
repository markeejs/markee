import { afterEach, describe, expect, it, vi } from 'vitest'

const RealDate = Date

async function importConstants(
  now: string,
  {
    failResolve = false,
    cwd = process.cwd(),
    initCwd,
  }: {
    failResolve?: boolean
    cwd?: string
    initCwd?: string
  } = {},
) {
  vi.resetModules()

  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      super(value ?? now)
    }

    static now() {
      return new RealDate(now).valueOf()
    }
  }

  vi.stubGlobal('Date', MockDate)
  vi.spyOn(process, 'cwd').mockReturnValue(cwd)
  if (initCwd !== undefined) {
    vi.stubEnv('INIT_CWD', initCwd)
  }
  if (failResolve) {
    vi.doMock('./helpers/module.js', () => ({
      ModuleHelpers: {
        resolve: vi.fn(() => {
          throw new Error('missing')
        }),
      },
    }))
  }

  return await import('./constants.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('constants', () => {
  it('resolves CLI constants and uses the default prefix outside seasonal dates', async () => {
    const { ROOT_DIR, CLIENT_FILE, CLIENT_DIR, MARKEE, MARKEE_PREFIX } =
      await importConstants('2026-03-20T12:00:00.000Z')

    expect(ROOT_DIR).toBe(process.cwd())
    expect(CLIENT_FILE).toContain('/packages/core/client/')
    expect(CLIENT_DIR).toContain('/packages/core/client/')
    expect(MARKEE).toContain('Mark')
    expect(MARKEE_PREFIX.get()).toContain('/')
    expect(MARKEE_PREFIX.next()).toContain('/')
  })

  it('switches to christmas glyphs on december 23 and later', async () => {
    const { MARKEE_PREFIX } = await importConstants('2026-12-24T12:00:00.000Z')

    expect(MARKEE_PREFIX.get()).toBe('🎄  ')
    expect(MARKEE_PREFIX.get()).toBe('🎁  ')
    expect(MARKEE_PREFIX.next()).toBe('🎁  ')
  })

  it('switches to halloween glyphs on october 31', async () => {
    const { MARKEE_PREFIX } = await importConstants('2026-10-31T12:00:00.000Z')

    expect(MARKEE_PREFIX.get()).toBe('🎃  ')
    expect(MARKEE_PREFIX.get()).toBe('🦇  ')
    expect(MARKEE_PREFIX.next()).toBe('🦇  ')
  })

  it('falls back to an empty client path when the client package cannot be resolved', async () => {
    const { CLIENT_FILE, CLIENT_DIR } = await importConstants(
      '2026-03-20T12:00:00.000Z',
      { failResolve: true },
    )

    expect(CLIENT_FILE).toBe('')
    expect(CLIENT_DIR).toBe('.')
  })

  it('falls back to INIT_CWD when process.cwd() is empty', async () => {
    const { ROOT_DIR } = await importConstants('2026-03-20T12:00:00.000Z', {
      cwd: '',
      initCwd: '/from-init-cwd',
    })

    expect(ROOT_DIR).toBe('/from-init-cwd')
  })
})
