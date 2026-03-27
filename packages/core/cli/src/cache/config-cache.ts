import type { Configuration } from '@markee/types'
import fs from 'fs-extra'
import yaml from 'yaml'

import { PathHelpers } from '../helpers/path.js'

export interface CliConfig extends Configuration {
  sources: {
    root: string
    mount?: string
    layout?: string
  }[]
  server: {
    host: string
    port: number
  }
  build: {
    outDir: string
    inlineHeadAssets?: InlineHeadAssetsConfig
    minify?:
      | boolean
      | {
          js?: boolean
          css?: boolean
        }
    splits?: Record<string, string>
    skipLinkValidation?: boolean
    rss?: Record<
      string,
      {
        filter: {
          folder?: string
          author?: string | string[]
          tag?: string | string[]
        }
        settings: {
          site: string
          title: string
          description?: string
          size?: number
          language?: string
          managingEditor?: string
          webMaster?: string
        }
      }
    >
    sitemap?: {
      site: string
    }
  }
  watch?: string[]
  extensions?: string[]
}

export type InlineHeadAssetsConfig =
  | boolean
  | {
      js?: number
      css?: number
    }

export type CliMode = 'preview' | 'production'
export type CliCommand = 'develop' | 'build' | 'serve' | 'init' | (string & {})

let _config: CliConfig | undefined
let _mode: CliMode | undefined
let _command: CliCommand | undefined

let _options:
  | {
      host: string
      port: number
      outDir: string
      skipLinkValidation: boolean
    }
  | undefined

function getRequiredValue<T>(
  key: 'config' | 'mode' | 'command',
  value: T | undefined,
): T {
  if (value === undefined) {
    throw new Error(`Markee CLI ${key} accessed before initialization`)
  }

  return value
}

export class ConfigCache {
  static get config() {
    return getRequiredValue('config', _config)
  }

  static set config(value: CliConfig) {
    _config = value
  }

  static get mode() {
    return getRequiredValue('mode', _mode)
  }

  static set mode(value: CliMode) {
    _mode = value
  }

  static get command() {
    return getRequiredValue('command', _command)
  }

  static set command(value: CliCommand) {
    _command = value
  }

  static async loadConfig(
    root: string,
    options:
      | {
          host: string
          port: number
          outDir: string
          skipLinkValidation: boolean
        }
      | undefined = _options,
  ) {
    _options = options

    // Try yaml, then yml, then .rc
    const config = await fs
      .readFile(PathHelpers.concat(root, './markee.yaml'), 'utf8')
      .catch(() =>
        fs.readFile(PathHelpers.concat(root, './markee.yml'), 'utf8'),
      )
      .catch(() => fs.readFile(PathHelpers.concat(root, './.markeerc'), 'utf8'))
      .catch(() => '')

    const parsedConfig = (yaml.parse(config) ?? {}) as CliConfig
    parsedConfig.sources ||= []
    const defaultBuild = { outDir: 'site' }
    parsedConfig.build = {
      ...defaultBuild,
      ...parsedConfig.build,
      ...(options?.outDir ? { outDir: options.outDir } : {}),
      ...(options?.skipLinkValidation
        ? { skipLinkValidation: options.skipLinkValidation }
        : {}),
    }
    const defaultServer = { port: 8000, host: '0.0.0.0' }
    parsedConfig.server = {
      ...defaultServer,
      ...parsedConfig.server,
      ...(options?.host ? { host: options.host } : {}),
      ...(options?.port ? { port: options.port } : {}),
    }

    this.config = parsedConfig
  }

  static get() {
    return this.config
  }

  /**
   * Helper function to remove entries from the config we don't want to share
   * on the client side
   */
  static filterConfig(): Configuration {
    const {
      sources: _1,
      server: _2,
      build: _3,
      extensions: _4,
      ...configuration
    } = this.config
    return configuration
  }

  /**
   * Helper function for sanitizing a source's root by getting rid of optional
   * leading slash, leading dot-slash, or trailing slash
   * @param root - unsanitized root
   */
  static getRoot(root: string) {
    return root.match(/^\.?\/?(.+?)\/?$/)?.[1] ?? ''
  }

  /**
   * Read splits from config and return an ordered array of {folder: string, root: string}
   * objects. Make sure folder and root are prefixed with /. Optionally read roots from
   * environment variables
   */
  static getSplits() {
    return Object.keys(this.config.build.splits ?? {})
      .sort((a, b) =>
        this.config.build.splits![b].localeCompare(
          this.config.build.splits![a],
        ),
      )
      .map((split) => {
        const baseFolder = this.config.build.splits![split]
        const folder = baseFolder.startsWith('/')
          ? baseFolder
          : '/' + baseFolder

        const splitSlug = split.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const splitVariable =
          'MARKEE_SPLIT_' + split.toUpperCase().replace(/[^A-Z0-9]/g, '_')

        const baseRoot = process.env[splitVariable] ?? '/_splits/' + splitSlug
        const root = baseRoot.startsWith('/') ? baseRoot : '/' + baseRoot

        return { folder, root }
      })
  }

  static reset() {
    _config = undefined
    _mode = undefined
    _command = undefined
    _options = undefined
  }
}
