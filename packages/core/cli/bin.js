#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const userAgent = process.env.npm_config_user_agent ?? ''
const requestedRuntime =
  process.env.MARKEE_RUNTIME ?? (userAgent.startsWith('bun/') ? 'bun' : 'node')
const isRunningInBun = typeof Bun !== 'undefined'

if (
  !process.env.MARKEE_RUNTIME_REEXEC &&
  ((requestedRuntime === 'bun' && !isRunningInBun) ||
    (requestedRuntime === 'node' && isRunningInBun))
) {
  const runtime = requestedRuntime === 'bun' ? 'bun' : 'node'
  const entrypoint = fileURLToPath(new URL('./dist/index.js', import.meta.url))
  const result = spawnSync(runtime, [entrypoint, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      MARKEE_RUNTIME_REEXEC: '1',
    },
  })

  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

await import('./dist/index.js')
