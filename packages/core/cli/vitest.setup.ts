import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()

  delete (globalThis as { config?: unknown }).config
  delete (globalThis as { mode?: unknown }).mode
  delete (globalThis as { command?: unknown }).command
})
