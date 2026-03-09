import fs from 'fs-extra'
import yaml from 'yaml'

import { PathHelpers } from '../helpers/path.js'

let _options:
  | {
      host: string
      port: number
      outDir: string
      skipLinkValidation: boolean
    }
  | undefined

export class ConfigCache {
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

    global.config = yaml.parse(config) ?? {}
    global.config.sources ||= []
    const defaultBuild = { outDir: 'site' }
    global.config.build = {
      ...defaultBuild,
      ...global.config.build,
      ...(options?.outDir ? { outDir: options.outDir } : {}),
      ...(options?.skipLinkValidation
        ? { skipLinkValidation: options.skipLinkValidation }
        : {}),
    }
    const defaultServer = { port: 8000, host: '0.0.0.0' }
    global.config.server = {
      ...defaultServer,
      ...global.config.server,
      ...(options?.host ? { host: options.host } : {}),
      ...(options?.port ? { port: options.port } : {}),
    }
  }

  static get() {
    return global.config
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
    } = config
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
    return Object.keys(config.build.splits ?? {})
      .sort((a, b) =>
        config.build.splits![b].localeCompare(config.build.splits![a]),
      )
      .map((split) => {
        const baseFolder = config.build.splits![split]
        const folder = baseFolder.startsWith('/')
          ? baseFolder
          : '/' + baseFolder

        const splitSlug = split.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const splitVariable =
          'MARBLES_SPLIT_' + split.toUpperCase().replace(/[^A-Z0-9]/g, '_')

        const baseRoot = process.env[splitVariable] ?? '/_splits/' + splitSlug
        const root = baseRoot.startsWith('/') ? baseRoot : '/' + baseRoot

        return { folder, root }
      })
  }
}
