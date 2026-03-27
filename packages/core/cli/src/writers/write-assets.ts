import fs from 'fs-extra'
import colors from 'colors/safe.js'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'

import { PathHelpers } from '../helpers/path.js'
import { FilesystemHelpers } from '../helpers/filesystem.js'

import { ExtensionsCache } from '../cache/extensions-cache.js'

/**
 * Writer step which copies all asset files from extensions and the main project into the build folder,
 * including all sources. Markdown files will get overwritten later, but it's
 * faster to copy the directories completely than copying file by file to
 * filter out the Markdown
 */
export async function writeAssets() {
  const extensions = ExtensionsCache.loadExtensionsContent()
  const extensionKeys = Object.keys(extensions).reverse()

  const outDir = ConfigCache.config.build.outDir
  const sources = ConfigCache.config.sources

  const promises: Promise<void>[] = []

  for (const extension of extensionKeys) {
    if (
      await fs.pathExists(
        PathHelpers.concat(
          PathHelpers.dirname(extensions[extension].file),
          '_assets',
        ),
      )
    ) {
      await FilesystemHelpers.copyDirectory(
        PathHelpers.concat(
          PathHelpers.dirname(extensions[extension].file),
          '_assets',
        ),
        PathHelpers.concat(
          ROOT_DIR,
          outDir,
          '_assets',
          '_extension',
          extension,
        ),
      ).catch(
        FilesystemHelpers.handleCopyError(
          'Error copying assets for extension',
          extension,
        ),
      )
    }

    for (const flatten of extensions[extension].flatten ?? []) {
      if (flatten.startsWith('/_assets') || flatten.startsWith('_assets')) {
        const flattenDir = PathHelpers.concat('/', flatten).slice(1)
        const flattenParent = PathHelpers.concat(flattenDir, '..')

        const originPath = PathHelpers.concat(
          ROOT_DIR,
          outDir,
          '_assets',
          '_extension',
          extension,
          flattenDir,
        )
        const destinationPath = PathHelpers.concat(
          ROOT_DIR,
          outDir,
          flattenParent,
        )

        promises.push(
          Promise.resolve().then(async () => {
            await FilesystemHelpers.copyDirectory(
              originPath,
              destinationPath,
            ).catch(
              FilesystemHelpers.handleCopyError(
                'Error moving files from',
                originPath,
              ),
            )
            await fs
              .remove(originPath)
              .catch(
                FilesystemHelpers.handleCopyError(
                  'Error moving files from',
                  originPath,
                ),
              )
          }),
        )
      } else {
        console.log(colors.yellow('You can only flatten content from /_assets'))
      }
    }
  }

  if (await fs.pathExists(PathHelpers.concat(ROOT_DIR, '_assets'))) {
    promises.push(
      FilesystemHelpers.copyDirectory(
        PathHelpers.concat(ROOT_DIR, '_assets'),
        PathHelpers.concat(ROOT_DIR, outDir),
      ).catch(FilesystemHelpers.handleCopyError('Error copying assets')),
    )
  }

  for (const source in sources) {
    const { root } = sources[source]
    const sourceRoot = root.startsWith('/') ? root.slice(1) : root
    const sourceRootParent = PathHelpers.concat(sourceRoot, '..')

    promises.push(
      FilesystemHelpers.copyDirectory(
        PathHelpers.concat(ROOT_DIR, sourceRoot),
        PathHelpers.concat(ROOT_DIR, outDir, sourceRootParent),
      ).catch(
        FilesystemHelpers.handleCopyError('Error copying source', source),
      ),
    )
  }

  return await Promise.all(promises)
}
