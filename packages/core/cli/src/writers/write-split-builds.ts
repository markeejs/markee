import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'

/**
 * Writer step which takes the list of files and folders as well as the search
 * index, and splits things according to the splits configuration.
 * It moves built assets to the correct split destination folder, and removes
 * split files from navigation.json and search.json, creating nested
 * version of those files inside each split instead
 * @param files - record of Markdown files
 * @param folders - record of Pages files
 * @param search - search index
 */
export async function writeSplitBuilds(
  files: Record<string, MarkdownFile>,
  folders: Record<string, SectionFile>,
  search: Record<string, { [anchor: string]: { l: string; c: string[] } }>,
) {
  if (!config.build.splits) return

  const splitsRoot = PathHelpers.concat(
    ROOT_DIR,
    config.build.outDir,
    '_splits',
  )
  await fs.ensureDir(splitsRoot)

  const splits = Object.keys(config.build.splits).sort((a, b) =>
    config.build.splits![b].localeCompare(config.build.splits![a]),
  )

  for (const folder in folders) {
    for (const split of splits) {
      const root = config.build.splits[split].startsWith('/')
        ? config.build.splits[split]
        : '/' + config.build.splits[split]

      if (folders[folder].navigation?.length) {
        for (const entry of folders[folder].navigation) {
          if (entry.key.startsWith(root) && !folder.startsWith(root)) {
            entry.split = true
          }
        }
      }

      if (folders[folder].excluded?.length) {
        for (const entry of folders[folder].excluded) {
          if (entry.key.startsWith(root) && !folder.startsWith(root)) {
            entry.split = true
          }
        }
      }

      if (folders[folder].versions?.length) {
        for (const entry of folders[folder].versions) {
          if (entry.key.startsWith(root) && !folder.startsWith(root)) {
            entry.split = true
          }
        }
      }
    }
  }

  const splitHosts: string[] = []

  for (const split of splits) {
    const splitFiles: Record<string, MarkdownFile> = {}
    const splitFolders: Record<string, SectionFile> = {}
    const splitSearch: Record<
      string,
      { [anchor: string]: { l: string; c: string[] } }
    > = {}

    const root = config.build.splits[split].startsWith('/')
      ? config.build.splits[split]
      : '/' + config.build.splits[split]
    const splitRoot = PathHelpers.concat(
      ROOT_DIR,
      config.build.outDir,
      root.slice(1),
    )
    const splitSlug = split.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const splitVariable =
      'MARKEE_SPLIT_' + split.toUpperCase().replace(/[^A-Z0-9]/g, '_')
    const splitHost = process.env[splitVariable] ?? '/_splits/' + splitSlug
    splitHosts.push(process.env[splitVariable] || '/_splits/' + splitSlug)

    if (split !== splitSlug) {
      console.log(
        `Split '${split}' has been renamed to '${splitSlug}' to be URL friendly.`,
      )
    }

    for (const file in files) {
      if (file.startsWith(root)) {
        splitFiles[file] = files[file]
        splitFiles[file].root = splitHost
        delete files[file]
      }
    }

    for (const folder in folders) {
      if (folder.startsWith(root)) {
        splitFolders[folder] = folders[folder]
        delete folders[folder]
      }
    }

    for (const entry in search) {
      if (entry.startsWith(root)) {
        splitSearch[entry] = search[entry]
        delete search[entry]
      }
    }

    await fs.move(
      splitRoot,
      PathHelpers.concat(splitsRoot, splitSlug, root.slice(1)),
    )
    await fs.ensureDir(PathHelpers.concat(splitsRoot, splitSlug, '_markee'))
    await fs.writeJSON(
      PathHelpers.concat(splitsRoot, splitSlug, '_markee', 'navigation.json'),
      { files: splitFiles, folders: splitFolders },
    )
    await fs.writeJSON(
      PathHelpers.concat(splitsRoot, splitSlug, '_markee', 'search.json'),
      splitSearch,
    )
  }

  search._splits = splitHosts as any
  return splitHosts
}
