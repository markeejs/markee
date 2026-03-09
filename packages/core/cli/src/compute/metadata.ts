import merge from 'deepmerge'

import { PathHelpers } from '../helpers/path.js'
import { FilesystemHelpers } from '../helpers/filesystem.js'

import { GitCache } from '../cache/git-cache.js'

export const MetadataCompute = {
  frontMatterInheritance: async (
    files: Record<string, MarkdownFile>,
    folders: Record<string, PagesFile>,
  ) => {
    await Promise.all(
      Object.keys(files)
        .filter((file) => !file.startsWith('/_assets/'))
        .map(async (file) => {
          // Compute the revision date for the file
          files[file].revisionDate = await GitCache.getRevisionDate(file)

          // Compute a list of all ancestors folders for the current file
          const ancestors = PathHelpers.dirname(file)
            .split('/')
            .map(
              (_, index, array) => array.slice(0, index + 1).join('/') || '/',
            )
            .reverse()

          // Do a deep merge of all `meta` fields found in `.pages` in the ancestors
          // of the current file
          const meta = merge.all(
            ancestors.map((curr) => folders[curr]?.meta ?? {}),
          ) as Frontmatter

          // If any ancestor is marked as draft or hidden, it should be inherited
          const ancestorDraft = ancestors.some(
            (ancestor) => folders[ancestor]?.draft,
          )
          const ancestorHidden = ancestors.some(
            (ancestor) => folders[ancestor]?.hidden,
          )

          // The file should always inherit its indexable property from its first (direct) ancestor
          const ancestorIndexable = folders[ancestors[0]]?.indexable

          // If the front-matter did not specify a title, we read it from its
          // ancestor's navigation, or infer it from its filename
          if (!files[file].frontMatter.title) {
            // Extract the base filename to use it as a base title
            const fileName = PathHelpers.basename(file, '.md')

            // Extract any title information from direct ancestors
            const ancestorTitle =
              // Check if the direct ancestor has a navigation entry which overrides the title
              folders[ancestors[0]]?.navigation.find((nav) => nav.key === file)
                ?.title ??
              // If not, check the next ancestor to see if it has an override for the current
              // file's folder if it's an index/same-name file
              folders[ancestors[1]]?.navigation.find((nav) => {
                if (fileName === 'index') {
                  return nav.key === PathHelpers.dirname(file)
                }
                return PathHelpers.basename(nav.key) === fileName
              })?.title

            // Set the file's title in its front-matter data
            files[file].frontMatter.title =
              ancestorTitle ||
              ((fileName[0]?.toUpperCase() ?? '') + fileName.slice(1))
                .replaceAll('-', ' ')
                .replaceAll('_', ' ')
          }

          // Merge front-matter with ancestor data
          files[file].frontMatter = {
            ...files[file].frontMatter,
            ...(ancestorDraft ? { draft: true } : {}),
            ...(ancestorHidden ? { hidden: true } : {}),
          }
          files[file].frontMatter = merge(
            meta ?? {},
            files[file].frontMatter ?? {},
          )

          // Inherit or set default value for indexable only if not found
          if (files[file].frontMatter.indexable === undefined) {
            files[file].frontMatter.indexable =
              ancestorIndexable ?? !files[file].frontMatter.hidden
          }

          // Copy layout info directly to the file's data
          if (files[file].frontMatter.layout) {
            files[file].layout = files[file].frontMatter.layout
          }

          // Remove drafts if in production mode
          if (files[file].frontMatter.draft && global.mode === 'production') {
            delete files[file]
          }

          // Remove direct descendants of a versioned folder
          if (folders[ancestors[0]]?.version?.folder) {
            delete files[file]
          }
        }),
    )
  },

  versionedContentOrdering: (
    files: Record<string, MarkdownFile>,
    folders: Record<string, PagesFile>,
  ) => {
    Object.keys(folders).map((key) => {
      const folder = folders[key]

      folder.versions = folder.versions?.sort((a, b) => {
        const aFile = files[a.key]
        const bFile = files[b.key]
        const aFolder = folders[a.key]
        const bFolder = folders[b.key]
        const aDate =
          aFile?.frontMatter?.version?.date ?? aFolder?.version?.date
        const bDate =
          bFile?.frontMatter?.version?.date ?? bFolder?.version?.date

        if (aDate && bDate) {
          return new Date(bDate).valueOf() - new Date(aDate).valueOf()
        }

        if (aDate && !bDate) {
          return -1
        }

        if (bDate && !aDate) {
          return 1
        }

        return FilesystemHelpers.sortFiles(b.key, a.key)
      })
      const latest = folder.versions?.[0]
      const latestFolder = folders[latest?.key as string]
      const latestFile = files[latest?.key as string]
      const pathname = folder.version?.latestPathAlias ?? ''

      if (folder.version?.folder && latestFolder) {
        Object.values(files).forEach((file) => {
          if (
            latestFolder.link &&
            folder.link &&
            file.link.startsWith(latestFolder.link)
          ) {
            file.alias ??= []
            file.alias.push(file.link)
            file.alias = [...new Set(file.alias)]
            file.link = file.link.replace(
              latestFolder.link,
              PathHelpers.concat(folder.link, pathname),
            )
          }
        })
        Object.values(folders).forEach((pageFile) => {
          if (
            folder.link &&
            latestFolder.link &&
            pageFile.link?.startsWith(latestFolder.link)
          ) {
            pageFile.alias ??= []
            pageFile.alias.push(pageFile.link)
            pageFile.alias = [...new Set(pageFile.alias)]
            pageFile.link = pageFile.link.replace(
              latestFolder.link,
              PathHelpers.concat(folder.link, pathname),
            )
          }
        })
      } else if (latestFile && folder.link) {
        latestFile.alias ??= []
        latestFile.alias.push(latestFile.link)
        latestFile.alias = [...new Set(latestFile.alias)]
        latestFile.link = PathHelpers.concat(folder.link, pathname)
      }
    })
  },
}
