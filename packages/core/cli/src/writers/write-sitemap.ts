import type { MarkdownFile } from '@markee/types'
import fs from 'fs-extra'
import { Readable } from 'stream'
import { SitemapStream, streamToPromise } from 'sitemap'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'
import { PathHelpers } from '../helpers/path.js'

/**
 * Writer step which takes the list of Markdown files and generates a sitemap
 * if the configuration is enabled
 * @param files - Record of Markdown files
 */
export async function writeSitemap(files: Record<string, MarkdownFile>) {
  const hostname = ConfigCache.config.build.sitemap?.site
  if (!hostname) return

  const links = Object.values(files).flatMap((f) => [
    f.link,
    ...(f.alias ?? []),
  ])

  const stream = new SitemapStream({ hostname })
  const promise = streamToPromise(Readable.from(links).pipe(stream))

  const xml = await promise.then((data) => data.toString()).catch(() => '')

  if (xml) {
    await fs.ensureDir(
      PathHelpers.concat(ROOT_DIR, ConfigCache.config.build.outDir),
    )
    await fs.writeFile(
      PathHelpers.concat(
        ROOT_DIR,
        ConfigCache.config.build.outDir,
        'sitemap.xml',
      ),
      xml,
      'utf-8',
    )
    await fs.writeFile(
      PathHelpers.concat(
        ROOT_DIR,
        ConfigCache.config.build.outDir,
        'robots.txt',
      ),
      `Sitemap: ${hostname}${hostname.endsWith('/') ? '' : '/'}sitemap.xml`,
    )
  }
}
