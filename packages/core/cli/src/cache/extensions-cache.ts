import yaml from 'yaml'
import fs from 'fs-extra'
import colors from 'colors/safe.js'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'
import { ModuleHelpers } from '../helpers/module.js'

interface Extension {
  file: string
  extensions?: string[]
  flatten?: string[]
}

const VALID_EXTENSIONS = ['.mjs', '.js']

export class ExtensionsCache {
  static extensions: Record<string, string> | undefined = undefined
  static content: Record<string, Extension> | undefined = undefined
  static buildTime: string[] | undefined = undefined

  static loadExtensions() {
    if (this.extensions) return this.extensions

    const extensions: Record<string, string> = Object.fromEntries(
      (config.extensions ?? [])
        .map((extension) => {
          try {
            return [
              extension,
              PathHelpers.sanitize(ModuleHelpers.resolve(extension)),
            ]
          } catch (err) {
            void err
            console.log(
              colors.yellow('Could not find extension'),
              colors.bold(colors.yellow(extension)) + colors.yellow('.'),
              colors.yellow('Is is installed?'),
            )
          }
        })
        .filter((e) => !!e),
    )

    let keys = 0
    while (keys !== Object.keys(extensions).length) {
      keys = Object.keys(extensions).length
      Object.keys(extensions).forEach((extension) => {
        try {
          const config = yaml.parse(
            fs.readFileSync(extensions[extension], 'utf8').trim() || '{}',
          )
          if (config.extensions) {
            config.extensions.forEach((ext: string) => {
              extensions[ext] = PathHelpers.sanitize(ModuleHelpers.resolve(ext))
            })
          }
        } catch (err) {
          console.error('Error parsing', extensions[extension])
          console.error(err)
        }
      })
    }

    extensions['@markee/default'] = PathHelpers.sanitize(
      ModuleHelpers.resolve('@markee/default'),
    )

    this.extensions = extensions
    return extensions
  }

  static loadExtensionsContent() {
    if (this.content) return this.content

    const extensions = this.loadExtensions()
    const extensionsContent: Record<string, Extension> = {}

    Object.keys(extensions).forEach((extension) => {
      try {
        extensionsContent[extension] = {
          file: extensions[extension],
          ...yaml.parse(fs.readFileSync(extensions[extension], 'utf8') || '{}'),
        }
      } catch (err) {
        void err
        console.error('Error parsing', extensions[extension])
      }
    })

    this.content = extensionsContent
    return extensionsContent
  }

  /**
   * Check if a given files exists inside an extension
   * @param file - file to look for
   */
  static async getExtensionFile(file: string) {
    const extensions = ExtensionsCache.loadExtensionsContent()
    const candidates = Object.entries(extensions).filter(([, conf]) => {
      return !!(
        conf.flatten &&
        conf.flatten.some((p) => file.startsWith(PathHelpers.concat('/', p)))
      )
    })
    if (candidates.length) {
      for (const candidate of candidates) {
        try {
          const filePath = PathHelpers.concat(
            PathHelpers.sanitize(
              PathHelpers.dirname(ModuleHelpers.resolve(candidate[0])),
            ),
            file,
          )
          const fileExists = await fs.pathExists(filePath)
          if (fileExists) {
            return filePath
          }
        } catch (err) {
          void err
        }
      }
    }
  }

  /**
   * List all extensions and check if they include any files to load at
   * build-time during the sanitation pipeline
   * Returns a list of all JS script files to side-load during sanitation
   */
  static getBuildTimeExtensions() {
    if (this.buildTime) return this.buildTime

    const extensions = ExtensionsCache.loadExtensionsContent()
    const buildFolders = Object.values(extensions).map((ext) => {
      const root = PathHelpers.sanitize(PathHelpers.dirname(ext.file))
      return PathHelpers.concat(root, '_assets/_build')
    })
    buildFolders.unshift(PathHelpers.concat(ROOT_DIR, '_assets/_build'))

    this.buildTime = buildFolders.flatMap((buildFolder) => {
      if (fs.existsSync(buildFolder)) {
        const candidates = fs.readdirSync(buildFolder)
        return candidates
          .filter(
            (c) =>
              !c.startsWith('_') &&
              VALID_EXTENSIONS.some((ext) => c.endsWith(ext)),
          )
          .map((c) => PathHelpers.concat(buildFolder, c))
      }

      return []
    })
    return this.buildTime
  }

  static hasBuildTimeExtensions() {
    return this.getBuildTimeExtensions().length > 0
  }

  static clearAll() {
    delete this.extensions
    delete this.content
    delete this.buildTime
  }
}
