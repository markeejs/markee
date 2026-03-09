#!/usr/bin/env node
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const initEntrypoint = require.resolve('@markee/cli/dist/commands/init.js')
const { commandInit } = await import(pathToFileURL(initEntrypoint).href)

global.command = 'init'
global.mode = 'production'

await commandInit()
