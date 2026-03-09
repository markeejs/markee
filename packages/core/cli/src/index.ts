import colors from 'colors/safe.js'
import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'

import { ROOT_DIR, MARKEE_PREFIX, MARKEE } from './constants.js'
import { ConfigCache } from './cache/config-cache.js'
import { commandDev } from './commands/dev.js'
import { commandBuild } from './commands/build.js'
import { commandInit } from './commands/init.js'
import { commandServe } from './commands/serve.js'

const optionDefinitions = [
  { name: 'command', defaultOption: true },
  {
    name: 'host',
    alias: 'h',
    type: String,
    description: 'Specify the host, defaults to {underline 127.0.0.1}',
  },
  {
    name: 'port',
    alias: 'p',
    type: Number,
    description: 'Specify the port, defaults to {underline 8000}',
  },
  {
    name: 'outDir',
    alias: 'o',
    type: String,
    description: 'Specify the output folder, defaults to {underline site}',
  },
  {
    name: 'mode',
    alias: 'm',
    type: String,
    defaultValue: 'production',
    description:
      'Specify the mode. If set to {underline production}, draft files are excluded. Defaults to {underline production}',
    typeLabel: '{underline production|preview}',
  },
  { name: 'help', type: Boolean, description: 'Display this usage guide' },
  {
    name: 'skipLinkValidation',
    type: Boolean,
    defaultValue: false,
    description:
      'Do not stop build if missing links are detected, just report them in the console and continue the build',
  },
]
const commandAliasMap: Record<string, string> = {
  dev: 'develop',
  develop: 'develop',
  start: 'develop',
  serve: 'serve',
  preview: 'serve',
  build: 'build',
  init: 'init',
}
const commandName = {
  develop: 'development',
  build: 'build',
  serve: 'preview',
  init: 'initialization',
}

const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true })
const usage = commandLineUsage([
  {
    header: 'Markee CLI',
    content: 'Build & develop Markdown-based websites with ease',
  },
  {
    header: 'Commands',
    content: [
      { name: 'dev (develop, start)', summary: 'Run development server' },
      { name: 'build', summary: 'Build the website' },
      { name: 'serve (preview)', summary: 'Serve the built website' },
      { name: 'init', summary: 'Initialize a new Markee project' },
    ],
  },
  {
    header: 'Options',
    optionList: optionDefinitions.slice(1),
  },
])

if (options.help || !options.command) {
  console.log(usage)
  process.exit(0)
}

global.command = commandAliasMap[options.command] || options.command
global.mode = global.command === 'develop' ? 'preview' : options.mode

if (global.command !== 'init') {
  const baseLog = console.log.bind(console)
  console.log = (...args) => {
    process.stdout.write(MARKEE_PREFIX.get())
    return baseLog(...args)
  }
}

console.log(MARKEE, 'starting up...')
await ConfigCache.loadConfig(ROOT_DIR, options as any)
console.log('Entering', colors.blue(commandName[global.command]), 'mode')

const command = {
  develop: commandDev,
  build: commandBuild,
  serve: commandServe,
  init: commandInit,
}[global.command]

if (command) {
  await command()
} else {
  console.log(
    colors.red('Fatal:'),
    'unknown command. Use --help to see available commands.',
  )
  console.log(usage)
  process.exit(1)
}
