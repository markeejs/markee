import fs from 'fs-extra'
import { globby } from 'globby'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'

import { PathHelpers } from '../helpers/path.js'
import { BuildMinifyHelpers } from '../helpers/build-minify.js'

const BUILD_MINIFY_JS_PATTERNS = [
  '**/*.js',
  '**/*.mjs',
  '!**/*.min.js',
  '!**/*.min.mjs',
]
const BUILD_MINIFY_CSS_PATTERNS = ['**/*.css', '!**/*.min.css']

function getBuildMinifyPatterns() {
  const patterns: string[] = []

  if (BuildMinifyHelpers.enabled('js')) {
    patterns.push(...BUILD_MINIFY_JS_PATTERNS)
  }
  if (BuildMinifyHelpers.enabled('css')) {
    patterns.push(...BUILD_MINIFY_CSS_PATTERNS)
  }

  return patterns
}

async function addFilesInDirectory(
  files: Set<string>,
  root: string,
  patterns: string[],
) {
  if (!(await fs.pathExists(root))) {
    return
  }

  const matched = await globby(patterns, {
    cwd: root,
    absolute: true,
  })

  matched.forEach((file) => files.add(PathHelpers.sanitize(file)))
}

export async function writeMinify() {
  const patterns = getBuildMinifyPatterns()

  if (!patterns.length) {
    return
  }

  const outRoot = PathHelpers.concat(ROOT_DIR, ConfigCache.config.build.outDir)
  const files = new Set<string>()

  await addFilesInDirectory(
    files,
    PathHelpers.concat(outRoot, '_assets'),
    patterns,
  )

  await Promise.all(
    [...files].map(async (file) => {
      const source = await fs.readFile(file, 'utf8')
      const next = await BuildMinifyHelpers.minifyContent(file, source)

      if (next !== source) {
        await fs.writeFile(file, next, 'utf8')
      }
    }),
  )
}
