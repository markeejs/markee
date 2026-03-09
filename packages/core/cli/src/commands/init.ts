import colors from 'colors/safe.js'
import Enquirer from 'enquirer'
import fs from 'fs-extra'
import { fileURLToPath } from 'node:url'
import yaml from 'yaml'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'

const prompts = new Enquirer()

type InitSource = {
  root: string
  mount?: string
  layout?: string
}

const configFilenames = ['markee.yaml', 'markee.yml', '.markeerc']

function getRootPath(filename: string) {
  return PathHelpers.concat(ROOT_DIR, filename)
}

function formatValue(label: string, value?: string) {
  return value ? `${label}: ${value}` : undefined
}

function formatSource(source: InitSource, index: number) {
  return [
    `${index + 1}. ${source.root}`,
    formatValue('mount', source.mount),
    formatValue('layout', source.layout),
  ]
    .filter(Boolean)
    .join(', ')
}

function sanitizeOptional(value?: string) {
  return value?.trim() ? value.trim() : undefined
}

function slugifyPackageName(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'markee-project'
  )
}

function getInstallCommand() {
  const userAgent = process.env.npm_config_user_agent ?? ''

  if (userAgent.startsWith('pnpm/')) {
    return 'pnpm install'
  }

  if (userAgent.startsWith('yarn/')) {
    return 'yarn install'
  }

  if (userAgent.startsWith('bun/')) {
    return 'bun install'
  }

  return 'npm install'
}

async function promptSource(source?: InitSource): Promise<InitSource> {
  const root = await promptInput('Source root', {
    defaultValue: source?.root,
    allowEmpty: false,
  })
  const mount = await promptInput('Source mount (optional)', {
    defaultValue: source?.mount,
    clearToken: source?.mount ? '-' : undefined,
  })
  const layout = await promptInput('Source layout (optional)', {
    defaultValue: source?.layout,
    clearToken: source?.layout ? '-' : undefined,
  })

  return {
    root: root!.trim(),
    mount: sanitizeOptional(mount),
    layout: sanitizeOptional(layout),
  }
}

async function promptInput(
  message: string,
  {
    defaultValue,
    allowEmpty = true,
    clearToken,
  }: {
    defaultValue?: string
    allowEmpty?: boolean
    clearToken?: string
  } = {},
) {
  while (true) {
    const answer = (
      (await prompts.prompt({
        type: 'input',
        name: 'value',
        message: clearToken
          ? `${message} ${colors.gray(`(type ${clearToken} to clear)`)}`
          : message,
        initial: defaultValue,
      })) as { value: string }
    ).value.trim()

    if (clearToken && answer === clearToken) {
      return undefined
    }

    if (!answer && defaultValue !== undefined) {
      return defaultValue
    }

    if (!answer && !allowEmpty) {
      console.log(colors.red('Please enter a value.'))
      continue
    }

    return answer || undefined
  }
}

async function promptSelect<T>(
  message: string,
  options: { label: string; value: T }[],
  details: string[] = [],
) {
  console.clear()

  if (details.length) {
    console.log(details.join('\n'))
    console.log('')
  }

  const selected = (
    (await prompts.prompt({
      type: 'select',
      name: 'value',
      message,
      choices: options.map((option, index) => ({
        name: String(index),
        message: option.label,
      })),
    })) as { value: string }
  ).value

  return options[Number(selected)]!.value
}

async function getCliVersion() {
  const packageJsonPath = fileURLToPath(
    new URL('../../package.json', import.meta.url),
  )
  const packageJson = await fs.readJSON(packageJsonPath)
  return packageJson.version as string
}

async function upsertPackageJson(title: string) {
  const packageJsonPath = getRootPath('package.json')
  const cliVersion = await getCliVersion()
  const dependencyVersion = `^${cliVersion}`

  const packageJson = (await fs.pathExists(packageJsonPath))
    ? await fs.readJSON(packageJsonPath)
    : {}

  packageJson.name = slugifyPackageName(title)
  packageJson.dependencies ||= {}
  packageJson.dependencies['@markee/cli'] = dependencyVersion

  if (packageJson.devDependencies?.['@markee/cli']) {
    delete packageJson.devDependencies['@markee/cli']
    if (!Object.keys(packageJson.devDependencies).length) {
      delete packageJson.devDependencies
    }
  }

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
  )
}

async function writeConfig({
  title,
  sources,
}: {
  title?: string
  sources: InitSource[]
}) {
  const config = {
    ...(title?.trim() ? { title: title.trim() } : {}),
    ...(sources.length
      ? {
          sources: sources.map((source) => ({
            root: source.root,
            ...(source.mount ? { mount: source.mount } : {}),
            ...(source.layout ? { layout: source.layout } : {}),
          })),
        }
      : {}),
  }

  await fs.writeFile(getRootPath('markee.yaml'), yaml.stringify(config))
}

function getMenuDetails({
  title,
  sources,
}: {
  title?: string
  sources: InitSource[]
}) {
  return [
    `Website title: ${title?.trim() || colors.gray('(not set)')}`,
    `Sources: ${sources.length ? '' : colors.gray('(none yet)')}`,
    ...sources.map((source, index) => `  ${formatSource(source, index)}`),
  ]
}

export async function commandInit() {
  const existingConfig = await Promise.all(
    configFilenames.map(async (filename) => ({
      filename,
      exists: await fs.pathExists(getRootPath(filename)),
    })),
  ).then((files) => files.find((file) => file.exists))

  if (existingConfig) {
    console.log(
      colors.red('Fatal:'),
      `${existingConfig.filename} already exists. Aborting project initialization.`,
    )
    process.exit(1)
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(colors.red('Fatal:'), 'init requires an interactive terminal.')
    process.exit(1)
  }

  const state: { title?: string; sources: InitSource[] } = { sources: [] }

  while (true) {
    const action = await promptSelect(
      'Initialize a Markee project',
      [
        { label: 'Set website title', value: 'title' as const },
        { label: 'Add source', value: 'add' as const },
        ...(state.sources.length
          ? [
              { label: 'Edit source', value: 'edit' as const },
              { label: 'Delete source', value: 'delete' as const },
            ]
          : []),
        { label: 'Generate', value: 'generate' as const },
      ],
      getMenuDetails(state),
    )

    if (action === 'title') {
      state.title = await promptInput('Website title', {
        defaultValue: state.title,
      })
      continue
    }

    if (action === 'add') {
      state.sources.push(await promptSource())
      continue
    }

    if (action === 'edit') {
      const selected = await promptSelect(
        'Select a source to edit',
        state.sources.map((source, index) => ({
          label: formatSource(source, index),
          value: index,
        })),
      )
      state.sources[selected] = await promptSource(state.sources[selected])
      continue
    }

    if (action === 'delete') {
      const selected = await promptSelect(
        'Select a source to delete',
        state.sources.map((source, index) => ({
          label: formatSource(source, index),
          value: index,
        })),
      )
      state.sources.splice(selected, 1)
      continue
    }

    state.title ??= 'Markee Site'
    await upsertPackageJson(state.title)
    await writeConfig(state)
    console.log('Generated package.json and markee.yaml')
    console.log(
      `Run ${colors.bold(getInstallCommand())} to install dependencies, then ${colors.bold('markee start')} to start the development server.`,
    )
    return
  }
}
