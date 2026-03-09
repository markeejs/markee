import fs from 'fs-extra'
import colors from 'colors/safe.js'

import { MARKEE_PREFIX, ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'

import { HtmlCache } from '../cache/html-cache.js'
import { PagesCache } from '../cache/pages-cache.js'
import { ConfigCache } from '../cache/config-cache.js'
import { MarkdownCache } from '../cache/markdown-cache.js'
import { type Layouts, MetadataCache } from '../cache/metadata-cache.js'

import { writeRss } from '../writers/write-rss.js'
import { writeAssets } from '../writers/write-assets.js'
import { writeClient } from '../writers/write-client.js'
import { writeSitemap } from '../writers/write-sitemap.js'
import { writeSplitBuilds } from '../writers/write-split-builds.js'

const time = (label: string) => {
  console.time(label + '\u001b[32m')
  process.stdout.write(MARKEE_PREFIX.next() + label + '...\r')
}
const timeEnd = (label: string) => {
  console.timeEnd(label + '\u001b[32m')
  process.stdout.write('\u001b[39m')
}
const plural = (value: number) => (value > 1 ? 's' : '')

const defaultMd = () => ({
  link: '',
  frontMatter: { excerpt: '' },
  readingTime: 0,
  layout: '',
  payload: {},
})
function getLayoutsFiles(
  layouts: Layouts,
  files: Record<string, MarkdownFile>,
) {
  if (layouts.header) {
    files[layouts.header] = defaultMd()
  }
  if (layouts.footer) {
    files[layouts.footer] = defaultMd()
  }
  if (layouts.layouts) {
    Object.values(layouts.layouts).forEach((layout) => {
      if (layout.top) {
        files[layout.top] = defaultMd()
      }
      if (layout.left) {
        files[layout.left] = defaultMd()
      }
      if (layout.main) {
        files[layout.main] = defaultMd()
      }
      if (layout.right) {
        files[layout.right] = defaultMd()
      }
      if (layout.bottom) {
        files[layout.bottom] = defaultMd()
      }
    })
  }
}

export async function commandBuild() {
  console.time('Website built in' + '\u001b[32m')
  await fs.emptyDir(PathHelpers.concat(ROOT_DIR, config.build.outDir))
  await fs.ensureDir(
    PathHelpers.concat(ROOT_DIR, config.build.outDir, '_markee'),
  )

  time('Detecting Markdown sources')
  const files = await MarkdownCache.loadFiles()
  const layouts = await MetadataCache.layoutsDetails()
  timeEnd('Detecting Markdown sources')

  const copyPromise = writeAssets()
  const clientPromise = writeClient()
  const indexPromise = HtmlCache.index(true)
  const assetsListPromise = MetadataCache.assets()

  time('Loading navigation structure')
  const folders = await PagesCache.loadFolders(files)
  timeEnd('Loading navigation structure')

  time('Loading Markdown content')
  await MarkdownCache.loadMetadata(files, folders)
  timeEnd('Loading Markdown content')

  time('Treating Markdown content')

  // Pre-populate layout files
  getLayoutsFiles(layouts, files)

  // Sanitize all files
  const outFiles: Record<
    string,
    {
      sanitized: string
      searchIndex: string
    }
  > = Object.fromEntries(
    await Promise.all(
      Object.keys(files).map(async (file) => [
        file,
        {
          sanitized: await MarkdownCache.get(file).sanitize(),
          searchIndex: await MarkdownCache.get(file).index(),
        },
      ]),
    ),
  )

  // Populate preloaded payloads
  Object.keys(files).forEach((file) => {
    files[file].payload = MarkdownCache.get(file).payload
  })

  timeEnd('Treating Markdown content')

  const brokenLinks = await MarkdownCache.getAllBrokenLinks(files, folders)

  if (brokenLinks > 0) {
    const details = config.build.skipLinkValidation
      ? 'Run without build.skipLinkValidation for details.'
      : 'Stopping build.'
    console.log(
      colors.red('Found'),
      colors.red(`${brokenLinks}`),
      colors.red(`broken link${plural(brokenLinks)}. ${details}`),
    )

    if (!config.build.skipLinkValidation) {
      process.exit(1)
    }
  }

  time('Writing built assets')
  await copyPromise
  await Promise.all(
    Object.keys(outFiles).map(async (file) => {
      if (outFiles[file]) {
        await fs.ensureDir(
          PathHelpers.dirname(
            PathHelpers.concat(ROOT_DIR, `/${config.build.outDir}`, file),
          ),
        )
        await fs.writeFile(
          PathHelpers.concat(ROOT_DIR, `/${config.build.outDir}`, file),
          outFiles[file].sanitized,
          'utf8',
        )
      }
    }),
  )
  timeEnd('Writing built assets')

  time('Writing metadata to disk')
  const index = await indexPromise
  const assets = await assetsListPromise
  const search = await MetadataCache.searchIndex(files)

  await writeRss(files)
  await writeSitemap(files)
  const splits = await writeSplitBuilds(files, folders, search)

  await fs.writeJSON(`${config.build.outDir}/_markee/navigation.json`, {
    folders,
    files,
    assets,
    splits,
  })
  await fs.writeJSON(
    `${config.build.outDir}/_markee/config.json`,
    ConfigCache.filterConfig(),
  )
  await fs.writeJSON(`${config.build.outDir}/_markee/search.json`, search)
  await fs.writeJSON(`${config.build.outDir}/_markee/layouts.json`, layouts)
  await fs.writeFile(`${config.build.outDir}/index.html`, index, 'utf8')

  await clientPromise
  timeEnd('Writing metadata to disk')
  console.timeEnd('Website built in' + '\u001b[32m')
}
