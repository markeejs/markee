#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
  const result = spawnSync(
    runtime,
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        MARKEE_RUNTIME_REEXEC: '1',
      },
    },
  )

  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

const require = createRequire(import.meta.url)
const initEntrypoint = require.resolve('@markee/cli/dist/commands/init.js')
const { commandInit } = await import(pathToFileURL(initEntrypoint).href)

global.command = 'init'
global.mode = 'production'

await commandInit()
