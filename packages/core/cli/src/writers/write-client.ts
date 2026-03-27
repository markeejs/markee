import fs from 'fs-extra'
import colors from 'colors/safe.js'

import { CLIENT_DIR, ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'

import { PathHelpers } from '../helpers/path.js'
import { FilesystemHelpers } from '../helpers/filesystem.js'

/**
 * Writer step which copies the client code from @markee/client.
 * It also copies everything from /public first, to make sure /public content
 * cannot override @markee/client content
 */
export async function writeClient() {
  if (!CLIENT_DIR || CLIENT_DIR === '.') {
    console.log(
      colors.red('Impossible to find @markee/client. Did you build it?'),
    )
    process.exit(1)
    return
  }

  await fs
    .copy(
      PathHelpers.concat(ROOT_DIR, 'public'),
      PathHelpers.concat(ROOT_DIR, ConfigCache.config.build.outDir),
    )
    .catch(() => {})
  await FilesystemHelpers.copyDirectory(
    PathHelpers.concat(CLIENT_DIR, 'assets'),
    PathHelpers.concat(ROOT_DIR, ConfigCache.config.build.outDir),
  ).catch(FilesystemHelpers.handleCopyError('Error copying @markee/client'))
}
