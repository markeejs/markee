import RSS from 'rss'
import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'

/**
 * Build a complete URL for an article
 * @param site - base site URL
 * @param link - article link pathname
 */
function getArticleLink(site: string, link: string) {
  const articleUrl = new URL(site)
  articleUrl.pathname = link
  return articleUrl.toString()
}

/**
 * Writer step which takes the record of Markdown files and writes RSS
 * feeds based on the RSS configuration
 * @param files - Record of Markdown files
 */
export async function writeRss(files: Record<string, MarkdownFile>) {
  if (!config.build.rss) return

  await fs.ensureDir(PathHelpers.concat(ROOT_DIR, config.build.outDir, 'rss'))

  for (const feed in config.build.rss) {
    const feedFilter = config.build.rss[feed].filter
    const feedSettings = config.build.rss[feed].settings

    const feedUrl = new URL(feedSettings.site)
    feedUrl.pathname = '/rss/' + feed + '.xml'
    const rssFeed = new RSS({
      ...feedSettings,
      generator: 'Markee RSS',
      site_url: feedSettings.site,
      feed_url: feedUrl.toString(),
    })

    const filterFolder =
      feedFilter.folder &&
      (feedFilter.folder.startsWith('/')
        ? feedFilter.folder
        : '/' + feedFilter.folder)
    const filterAuthor = feedFilter.author
      ? [feedFilter.author].flat().map((s) => s.toLowerCase())
      : null
    const filterTag = feedFilter.tag
      ? [feedFilter.tag].flat().map((s) => s.toLowerCase())
      : null

    const _articles = Object.keys(files)
      .filter((fileName) => {
        const file = files[fileName]
        const fileAuthors = file.frontMatter?.authors?.map((a) =>
          a.toLowerCase(),
        )
        const fileTags = file.frontMatter?.tags?.map((a) => a.toLowerCase())

        let valid = !!fileAuthors?.length
        if (filterFolder) valid &&= fileName.startsWith(filterFolder)
        if (filterAuthor)
          valid &&= filterAuthor.every((author) =>
            fileAuthors?.includes(author),
          )
        if (filterTag)
          valid &&= filterTag.every((tag) => fileTags?.includes(tag))

        return valid
      })
      .sort((a, b) => {
        const aDate = new Date(
          files[a].frontMatter?.modificationDate ??
            files[a].frontMatter?.date ??
            files[a].revisionDate ??
            0,
        )
        const bDate = new Date(
          files[b].frontMatter?.modificationDate ??
            files[b].frontMatter?.date ??
            files[b].revisionDate ??
            0,
        )

        return bDate.valueOf() - aDate.valueOf()
      })
    const articles =
      feedSettings.size === -1
        ? _articles
        : _articles.slice(0, feedSettings.size ?? 10)

    articles.forEach((article) => {
      rssFeed.item({
        title: files[article].frontMatter?.title ?? '',
        description: files[article].frontMatter?.excerpt ?? '',
        url: getArticleLink(feedSettings.site, files[article].link),
        guid: article,
        categories: files[article].frontMatter?.tags,
        author: files[article].frontMatter?.authors?.join(','),
        date: new Date(
          files[article].frontMatter?.modificationDate ??
            files[article].frontMatter?.date ??
            files[article].revisionDate ??
            0,
        ),
      })
    })

    await fs.writeFile(
      PathHelpers.concat(ROOT_DIR, config.build.outDir, 'rss', feed + '.xml'),
      rssFeed.xml(),
      'utf8',
    )
  }
}
