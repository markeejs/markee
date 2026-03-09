import yaml from 'yaml'
import fs from 'fs-extra'
import { globby } from 'globby'

import { ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'

import { ConfigCache } from './config-cache.js'
import { MarkdownCache } from './markdown-cache.js'
import { ExtensionsCache } from './extensions-cache.js'

/* Layouts */
export interface Layouts {
  header?: string
  footer?: string
  layouts: Record<
    string,
    {
      main?: string
      right?: string
      left?: string
      top?: string
      bottom?: string
    }
  >
}

/**
 * Read extension's config based on the provided extension file - which can be any
 * file inside an extension
 * @param file - extension file for which to resolve extension config
 */
async function readConfig(file: string) {
  if (file.startsWith('/_assets/_extension/')) {
    const extensionPath = file.slice('/_assets/_extension/'.length)
    const _extension = extensionPath.split('/').slice(0, 2)
    const extension =
      _extension[0][0] === '@' ? _extension.join('/') : _extension[0]
    const resolved = PathHelpers.dirname(
      PathHelpers.sanitize(new URL(import.meta.resolve(extension)).pathname),
    )
    return yaml.parse(
      await fs.readFile(
        PathHelpers.concat(resolved, extensionPath.slice(extension.length)),
        'utf8',
      ),
    )
  }

  return yaml.parse(
    await fs.readFile(PathHelpers.concat(ROOT_DIR, file), 'utf8'),
  )
}

/**
 * Get all layouts definition across current project or selected extension
 * @param root - root folder from which to start looking
 * @param extension - optional name of the extension we're looking into
 */
async function findLayouts(root: string, extension = ''): Promise<Layouts> {
  const extensionRoot = extension ? '_extension/' + extension + '/_assets/' : ''
  const _assets = await globby('**/*.(html|md|yaml|yml)', {
    cwd: PathHelpers.concat(root, '_assets'),
  })

  const header = _assets.find((file) => file.startsWith('_header.'))
  const footer = _assets.find((file) => file.startsWith('_footer.'))

  const layouts: Record<string, {}> = {}

  // Find layout files
  _assets.forEach((file) => {
    const [, layout, part] =
      file.match(/^_layouts\/(.*)?[./](main|right|left|top|bottom)\./) ?? []
    if (layout) {
      layouts[layout] = {
        ...layouts[layout],
        [part]: `/_assets/${extensionRoot}${file}`,
      }
    }
  })

  // Find default files
  _assets.forEach((file) => {
    const [, layout] =
      file.match(/^_layouts\/(.*)?[./]default\.(yaml|yml)/) ?? []
    if (layout) {
      layouts[layout] = {
        main: `/_assets/${extensionRoot}${file}`,
        right: `/_assets/${extensionRoot}${file}`,
        left: `/_assets/${extensionRoot}${file}`,
        top: `/_assets/${extensionRoot}${file}`,
        bottom: `/_assets/${extensionRoot}${file}`,
        ...layouts[layout],
      }
    }
  })

  return {
    header: header && `/_assets/${extensionRoot}${header}`,
    footer: footer && `/_assets/${extensionRoot}${footer}`,
    layouts,
  }
}

export class MetadataCache {
  static async searchIndex(files: Record<string, MarkdownFile>) {
    const indexable = Object.keys(files).filter(
      (key) => files[key].frontMatter.indexable,
    )
    return Object.fromEntries(
      await Promise.all(
        indexable.map(async (key) => [
          key,
          await MarkdownCache.get(key).index(),
        ]),
      ),
    )
  }

  static async layoutsDetails() {
    const extensions: Record<string, Layouts> = Object.fromEntries(
      await Promise.all(
        Object.entries(ExtensionsCache.loadExtensions()).map(
          async ([extension, extensionPath]) => [
            extension,
            await findLayouts(PathHelpers.dirname(extensionPath), extension),
          ],
        ),
      ),
    )

    const main = await findLayouts(ROOT_DIR)

    for (const extension of Object.values(extensions)) {
      main.header ??= extension.header
      main.footer ??= extension.footer

      Object.keys(extension.layouts).forEach((layout) => {
        main.layouts[layout] ??= extension.layouts[layout]
      })
    }

    const visited: string[] = []
    while (main.header?.endsWith('.yaml') || main.header?.endsWith('.yml')) {
      const config = await readConfig(main.header)
      const _part = config.section ?? 'header'

      if (config.extends && !visited.includes(config.extends)) {
        visited.push(config.extends)
        main.header = extensions[config.extends]?.[_part as 'header']
      } else {
        main.header = undefined
      }
    }
    visited.length = 0
    while (main.footer?.endsWith('.yaml') || main.footer?.endsWith('.yml')) {
      const config = await readConfig(main.footer)
      const _part = config.section ?? 'header'

      if (config.extends && !visited.includes(config.extends)) {
        visited.push(config.extends)
        main.footer = extensions[config.extends]?.[_part as 'footer']
      } else {
        main.footer = undefined
      }
    }

    for (const layout in main.layouts) {
      for (const part in main.layouts[layout]) {
        visited.length = 0
        while (
          main.layouts[layout][part as 'main']?.endsWith('.yaml') ||
          main.layouts[layout][part as 'main']?.endsWith('.yml')
        ) {
          const config =
            (await readConfig(main.layouts[layout][part as 'main']!)) ?? {}
          const _layout = config.layout ?? layout
          const _part = config.section ?? part

          if (!config.extends && _layout === layout && _part === part) {
            main.layouts[layout][part as 'main'] = undefined
          } else if (config.extends && !visited.includes(config.extends)) {
            visited.push(config.extends)
            main.layouts[layout][part as 'main'] =
              extensions[config.extends]?.layouts?.[_layout]?.[_part as 'main']
          } else {
            main.layouts[layout][part as 'main'] =
              main.layouts?.[_layout]?.[_part as 'main']
          }
        }
      }
    }

    return main
  }

  static async assets() {
    const splits = ConfigCache.getSplits()
    const sources = config.sources.map((source) =>
      ConfigCache.getRoot(source.root),
    )

    // Get all assets from /public and rebase them on /
    const publicAssets = (
      await globby('**/*', {
        cwd: PathHelpers.concat(ROOT_DIR, 'public'),
        dot: true,
      })
    )
      .map((file) => PathHelpers.concat('/', file))
      .map((file) => [PathHelpers.concat('/public', file), file])

    // Get all assets from /_assets
    const assetsAssets = (
      await globby('**/*', {
        cwd: PathHelpers.concat(ROOT_DIR, '_assets'),
        dot: true,
      })
    )
      .map((file) => PathHelpers.concat('/_assets/', file))
      .filter((file) => !file.endsWith('.md') && !file.endsWith('/.pages'))
      .map((file) => [file, file])

    // Get all assets from sources, excluding Markdown and .pages files,
    // and rebase them on their split if relevant
    const sourceAssets = await Promise.all(
      sources.map(async (source) => {
        const split = splits.find((s) => s.folder.startsWith('/' + source))
        return (
          await globby('**/*', {
            cwd: PathHelpers.concat(ROOT_DIR, source),
            dot: true,
          })
        )
          .map((file) => PathHelpers.concat('/', source, '/', file))
          .filter((file) => !file.endsWith('.md') && !file.endsWith('/.pages'))
          .map((file) => [
            file,
            split && command !== 'develop'
              ? file.replace(split.folder, split.root)
              : file,
          ])
      }),
    )

    return Object.fromEntries([
      ...sourceAssets.flat(),
      ...publicAssets,
      ...assetsAssets,
    ])
  }
}
