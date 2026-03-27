import colors from 'colors/safe.js'
import { transform as transformJavaScript } from 'esbuild'
import { transform as transformStylesheet } from 'lightningcss'

import { ConfigCache } from '../cache/config-cache.js'
import { ROOT_DIR } from '../constants.js'

import { PathHelpers } from './path.js'

type BuildMinifyKind = 'js' | 'css'

function getMinifyKind(filePath: string): BuildMinifyKind | null {
  if (filePath.endsWith('.min.css')) return null
  if (filePath.endsWith('.css')) return 'css'
  if (filePath.endsWith('.min.js') || filePath.endsWith('.min.mjs')) return null
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'js'
  return null
}

async function transformContent(
  kind: BuildMinifyKind,
  filePath: string,
  source: string,
) {
  if (kind === 'css') {
    const stylesheet = Buffer.from(
      transformStylesheet({
        filename: filePath,
        code: Buffer.from(source),
        minify: true,
      }).code,
    ).toString('utf8')

    return (
      await transformJavaScript(stylesheet, {
        loader: 'css',
        minify: true,
        sourcefile: filePath,
      })
    ).code
  }

  return (
    await transformJavaScript(source, {
      loader: 'js',
      minify: true,
      sourcefile: filePath,
    })
  ).code
}

export const BuildMinifyHelpers = {
  enabled(kind: BuildMinifyKind) {
    const minify = ConfigCache.config.build.minify
    return minify === true || (!!minify && minify[kind] === true)
  },

  async minifyContent(filePath: string, source: string) {
    const kind = getMinifyKind(filePath)

    if (!kind || !this.enabled(kind)) {
      return source
    }

    try {
      return await transformContent(kind, filePath, source)
    } catch (error) {
      const relative = PathHelpers.relative(ROOT_DIR, filePath)
      const message = error instanceof Error ? error.message : String(error)

      console.log(
        colors.yellow(
          `Skipping ${kind.toUpperCase()} minification for ${relative || filePath}: ${message}`,
        ),
      )

      return source
    }
  },
}
