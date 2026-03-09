import yaml from 'yaml'
import micromatch from 'micromatch'

import { PathHelpers } from '../helpers/path.js'
import { FilesystemHelpers } from '../helpers/filesystem.js'

import { FileCache } from '../cache/file-cache.js'
import { ConfigCache } from '../cache/config-cache.js'

type NamedEntry = { [key: string]: string }
type SubSection = { [key: string]: Navigation }
type DeepEntry = { [key: string]: { navigation: Navigation; order?: Order } }
type NavigationEntry = string | NamedEntry | SubSection | DeepEntry
type Navigation = NavigationEntry[]
type Order = 'desc' | 'asc'

type CleanNavigationEntry =
  | { key: string; title?: string }
  | { section: string; title: string; navigation: CleanNavigation }
  | { folder: string; navigation: CleanNavigation }
  | { pattern: string; for: string; dedupe?: boolean; order: Order }
  | { rest: true; for: string; dedupe?: boolean; order: Order }
type CleanNavigation = CleanNavigationEntry[]

const VERSION = Symbol()
const VERSIONING_INFO = Symbol()

function loadYamlContent<T = { navigation?: Navigation }>(content: string) {
  return yaml.parse(content || '{}') as T
}

function extractAllFolders(sourceFiles: string[]) {
  const folders: Record<string, boolean> = {}

  sourceFiles.forEach((file) => {
    const parts = PathHelpers.dirname(file).split('/')
    parts.forEach((_, i) => {
      const folder = parts.slice(0, i + 1).join('/') || '/'
      folders[folder] = true
    })
  })

  return Object.keys(folders)
}

function getLink(folder: string, sources: { mount?: string; root: string }[]) {
  const source = sources.find((source) =>
    folder.startsWith('/' + ConfigCache.getRoot(source.root)),
  )
  const sourceRoot = PathHelpers.concat('/', source?.root ?? '')
  return PathHelpers.concat(
    '/',
    source?.mount ?? source?.root ?? '',
    PathHelpers.relative(sourceRoot, folder),
  )
}

function inferTitle(pathname: string) {
  if (!pathname.endsWith('.md'))
    return (
      (PathHelpers.basename(pathname)[0]?.toUpperCase() ?? '') +
      PathHelpers.basename(pathname).slice(1)
    )
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
}

function applyFieldInheritance(
  navigation: Record<string, PagesFile>,
  config: PagesFile,
) {
  if (!config) return

  if ('hide' in config && !('hidden' in config)) {
    config.hidden = !!config.hide
  }

  ;[...(config.navigation ?? []), ...(config.excluded ?? [])].forEach(
    (entry) => {
      if (navigation[entry.key]) {
        if (config.hidden) {
          navigation[entry.key].hidden = true
        }

        if (config.draft) {
          navigation[entry.key].draft = true
        }

        navigation[entry.key].indexable ??= config.indexable

        applyFieldInheritance(navigation, navigation[entry.key])
      }
    },
  )
}

function sanitizePagesFile(entry: {
  title?: string
  nav?: Navigation
  navigation?: Navigation
  arrange?: string[]
}): { title?: string; navigation?: Navigation } {
  const arrange = entry.arrange
  delete entry.arrange

  if (entry.nav && !entry.navigation) entry.navigation = entry.nav
  if (!arrange || entry.nav || entry.navigation) {
    delete entry.nav
    return entry
  }

  const trimmed = arrange
    .map((file) => file.trim())
    .filter((e, i, a) => a.indexOf(e) === i)
  const rest = trimmed.indexOf('...')

  if (rest > -1) {
    trimmed.splice(rest, 1, '---', '--- | *.md')
    entry.navigation = trimmed
  } else {
    entry.navigation = ['---', ...trimmed, '--- | *.md']
  }

  return entry
}

function treatEntry(entry: string) {
  const [mode, ...parts] = entry.split('|').map((p) => p.trim())
  if (!['...', '---'].includes(mode)) return entry

  const dedupe = mode === '---'
  const pattern = parts.find((p) => !['asc', 'desc'].includes(p))
  const order = parts.find((p): p is Order => ['asc', 'desc'].includes(p))

  return { dedupe, order, pattern }
}

function simplifyNavigationStructure(
  navigation: Navigation,
  order: Order,
): CleanNavigation {
  return navigation.map((entry) => {
    if (typeof entry === 'string') {
      const entryInfo = treatEntry(entry)

      if (typeof entryInfo === 'string') {
        return { key: entry }
      }

      if (entryInfo.pattern) {
        return {
          pattern: entryInfo.pattern,
          for: '',
          order: entryInfo.order || order,
          dedupe: entryInfo.dedupe,
        }
      }

      return {
        rest: true,
        for: '',
        order: entryInfo.order || order,
        dedupe: entryInfo.dedupe,
      }
    }

    const [title] = Object.keys(entry)
    const config = entry[title]

    if (typeof config === 'string') {
      return { title, key: config }
    }

    if (Array.isArray(config)) {
      return {
        title,
        section: title,
        navigation: simplifyNavigationStructure(config, order),
      }
    }

    return {
      folder: title,
      ...config,
      navigation: simplifyNavigationStructure(
        config.navigation ?? [],
        config.order ?? order,
      ),
    }
  })
}

function resolveNavigationEntries(
  folder: string,
  navigation: CleanNavigation,
  folders: string[],
): CleanNavigation {
  return navigation.map((entry) => {
    if ('key' in entry) {
      if (entry.key.startsWith('http://') || entry.key.startsWith('https://')) {
        return { title: entry.key, ...entry }
      }

      return { ...entry, key: PathHelpers.concat(folder, entry.key) }
    }
    if ('folder' in entry) {
      return {
        ...entry,
        folder: PathHelpers.concat(folder, entry.folder),
        navigation: resolveNavigationEntries(
          PathHelpers.concat(folder, entry.folder),
          entry.navigation,
          folders,
        ),
      }
    }
    if ('section' in entry) {
      const resolveFolder = PathHelpers.concat(folder, entry.section)
      if (folders.includes(resolveFolder)) {
        const { section: _1, title: _2, ...rest } = entry
        return {
          folder: resolveFolder,
          ...rest,
          navigation: resolveNavigationEntries(
            resolveFolder,
            entry.navigation,
            folders,
          ),
        }
      }
      return {
        ...entry,
        navigation: resolveNavigationEntries(folder, entry.navigation, folders),
      }
    }
    return entry
  })
}

function extractExplicitFilesAndFoldersSet(
  filesSet: Set<string>,
  foldersSet: Set<string>,
  navigation: CleanNavigation,
) {
  navigation.forEach((entry) => {
    if ('key' in entry) {
      filesSet.delete(entry.key)
      foldersSet.delete(entry.key)
    }
    if ('folder' in entry) {
      foldersSet.delete(entry.folder)
    }
    if ('navigation' in entry) {
      extractExplicitFilesAndFoldersSet(filesSet, foldersSet, entry.navigation)
    }
  })
}

function extractNestedFolders(
  config: Record<
    string,
    {
      title?: string
      navigation?: Navigation | CleanNavigation
      [VERSION]?: number
    }
  >,
  navigation: CleanNavigation,
): CleanNavigation {
  return navigation.map((entry) => {
    if ('folder' in entry) {
      const { folder, navigation, ...rest } = entry

      if (!config[folder]) {
        config[folder] = {}
      }
      const version = config[folder][VERSION] ?? 1
      const suffix = '#' + version
      config[folder][VERSION] = version + 1

      config[folder + suffix] = { ...config[folder], ...rest }

      if (navigation) {
        config[folder + suffix].navigation = extractNestedFolders(
          config,
          navigation,
        )
      }

      return { key: folder + suffix, ...rest }
    }

    if ('navigation' in entry) {
      entry['navigation'] = extractNestedFolders(config, entry['navigation'])
    }

    return entry
  })
}

function applyPatternOrigin(
  origin: string,
  navigation: CleanNavigation,
): CleanNavigation {
  return navigation.map((entry) => {
    if ('pattern' in entry) {
      entry.for = origin
    }
    if ('rest' in entry) {
      entry.for = origin
    }
    if ('section' in entry) {
      entry.navigation = applyPatternOrigin(origin, entry.navigation)
    }
    return entry
  })
}

function extractNestedSections(
  config: Record<
    string,
    { title?: string; navigation?: Navigation | CleanNavigation }
  >,
  navigation: CleanNavigation,
  key: string,
): CleanNavigation {
  return navigation.map((entry) => {
    if ('section' in entry) {
      const { section, navigation, ...rest } = entry
      const folder = PathHelpers.concat(key, section)
      config[folder] = { ...rest }
      if (navigation) {
        config[folder].navigation = extractNestedSections(
          config,
          navigation,
          folder,
        )
      }
      return { key: folder, ...rest }
    }

    return entry
  })
}

function resolvePatterns(
  navigation: CleanNavigation,
  remainingFiles: Set<string>,
  remainingFolders: Set<string>,
): CleanNavigation {
  return navigation.flatMap((entry) => {
    if ('pattern' in entry) {
      const _pattern = entry.pattern
      const [kind, __pattern] = _pattern.split('=').map((e) => e.trim())
      const pattern = __pattern ?? kind
      const regex = ['regex', 'regexp'].includes(kind)
        ? new RegExp(
            `${pattern.startsWith('^') ? '' : '^'}${pattern}${pattern.includes('$') ? '' : '$'}`,
          )
        : null

      // Remove all files not descendant of the folder if the pattern uses a regex
      // or does not contain '../' somewhere, to make the matching quicker
      const preFilter =
        regex || !pattern.includes('../')
          ? (file: string) => file.startsWith(entry.for)
          : () => true
      // Filter either by regex or glob
      const filter = (file: string) => {
        if (regex) {
          return !file.includes('/') && regex.test(file)
        }
        return micromatch.isMatch(file, pattern)
      }
      // Sort asc or desc
      const sort =
        entry.order === 'asc'
          ? FilesystemHelpers.sortFiles
          : (a: string, b: string) => FilesystemHelpers.sortFiles(b, a)

      const dedupe = (e: string, i: number, a: string[]) => {
        if (!entry.dedupe) return true
        return a.indexOf(e) === i
      }

      const files = [...remainingFiles]
        .filter(preFilter)
        .map((file) => PathHelpers.relative(entry.for, file))
        .filter(filter)
        .map((file) => PathHelpers.concat(entry.for, file))
        .filter(dedupe)
        .sort(sort)
      const folders = [...remainingFolders]
        .filter(preFilter)
        .map((file) => PathHelpers.relative(entry.for, file))
        .filter(filter)
        .map((file) => PathHelpers.concat(entry.for, file))
        .filter(dedupe)
        .sort(sort)

      files.forEach((file) => remainingFiles.delete(file))
      folders.forEach((file) => remainingFolders.delete(file))

      return [
        ...folders.map((key) => ({ key })),
        ...files.map((key) => ({ key })),
      ] as CleanNavigationEntry[]
    }
    return [entry]
  })
}

function resolveRestEntries(
  navigation: CleanNavigation,
  remainingFiles: Set<string>,
  remainingFolders: Set<string>,
): CleanNavigation {
  return navigation.flatMap((entry) => {
    if ('rest' in entry) {
      const filter = (file: string) =>
        file !== entry.for &&
        file.startsWith(entry.for) &&
        !file.slice(entry.for.length + 1).includes('/')
      const sort =
        entry.order === 'asc'
          ? FilesystemHelpers.sortFiles
          : (a: string, b: string) => FilesystemHelpers.sortFiles(b, a)

      const files = [...remainingFiles].filter(filter).sort(sort)
      const folders = [...remainingFolders].filter(filter).sort(sort)

      files.forEach((file) => remainingFiles.delete(file))
      folders.forEach((file) => remainingFolders.delete(file))

      return [
        ...folders.map((key) => ({ key })),
        ...files.map((key) => ({ key })),
      ] as CleanNavigationEntry[]
    }
    return [entry]
  })
}

function trackExcludedFilesAndFolders(
  files: Record<string, MarkdownFile>,
  pages: Record<string, PagesFile>,
  remainingFiles: Set<string>,
  remainingFolders: Set<string>,
) {
  ;[...remainingFiles, ...remainingFolders].forEach((file) => {
    const parent = PathHelpers.dirname(file)

    if (pages[file] && file !== '/') {
      pages[file].hidden ??= true
      pages[file].indexable ??= false
    }

    if (files[file]) {
      files[file].frontMatter.hidden ??= true
    }

    if (pages[parent] && parent !== file) {
      pages[parent].excluded ??= []
      pages[parent].excluded.push({ key: file })
    }
  })
}

function resolveVersionedContent(pages: Record<string, PagesFile>) {
  Object.values(pages).forEach((page) => {
    if (VERSIONING_INFO in page && page[VERSIONING_INFO]) {
      page.version = { ...page.version, ...page[VERSIONING_INFO] }
      page.versions = [...page.navigation]
      page.navigation = []
      page.excluded = []
      page.title ??= (page[VERSIONING_INFO] as any).title
    }
  })
}

export const PagesCompute = {
  /**
   * Function for reading .pages across the project and resolving
   * the navigation structure
   * @param markdownFiles - record of markdown files to resolve
   *                        navigation against
   */
  async navigationStructure(markdownFiles: Record<string, MarkdownFile>) {
    const files = Object.keys(markdownFiles).sort(FilesystemHelpers.sortFiles)
    const folders = extractAllFolders(files).sort(FilesystemHelpers.sortFiles)
    const sourceRoots = config.sources.map((source) =>
      ConfigCache.getRoot(source.root),
    )

    let pagesFiles: Record<
      string,
      {
        link?: string
        title?: string
        inferredTitle?: string
        navigation?: Navigation | CleanNavigation
        order?: Order
        [VERSIONING_INFO]?: {
          title?: string
          folder?: boolean
        }
      }
    > = {}

    // Load .pages for each folder, if found. If not, provide a default implementation
    // which loads data from the filesystem (rest pattern)
    await Promise.all(
      folders.map(async (folder) => {
        const sectionKey = PathHelpers.concat(folder, '.section')
        const sectionFile = await FileCache.readProjectFile(sectionKey).catch(
          () => '',
        )

        const pagesKey = PathHelpers.concat(folder, '.pages')
        const pagesFile = await FileCache.readProjectFile(pagesKey).catch(
          () => '',
        )

        const dataFile = sectionFile || pagesFile || '{}'

        const versionKey = PathHelpers.concat(folder, '.version')
        const versionFile = await FileCache.readProjectFile(versionKey).catch(
          () => null,
        )

        pagesFiles[folder] = sanitizePagesFile({
          ...loadYamlContent(dataFile),
        })
        pagesFiles[folder].link = getLink(folder, config.sources)
        if (pagesFiles[folder].navigation) {
          pagesFiles[folder].navigation = simplifyNavigationStructure(
            pagesFiles[folder].navigation as Navigation,
            pagesFiles[folder].order || 'asc',
          )
          pagesFiles[folder].navigation = resolveNavigationEntries(
            folder,
            pagesFiles[folder].navigation as CleanNavigation,
            folders,
          )
        } else {
          pagesFiles[folder].navigation =
            folder === '/'
              ? sourceRoots.map((key) => ({ key: `/${key}` }))
              : [
                  {
                    rest: true,
                    for: '',
                    order: pagesFiles[folder].order || 'asc',
                  },
                ]
        }

        if (!pagesFiles[folder].title) {
          pagesFiles[folder].inferredTitle = inferTitle(folder)
        }

        if (versionFile !== null) {
          const version = loadYamlContent<{
            folder?: boolean
            mode?: 'folder' | 'file'
          }>(versionFile)
          version.folder = version.mode === 'folder'
          pagesFiles[folder][VERSIONING_INFO] = version
          pagesFiles[folder].navigation = version.folder
            ? ([
                { pattern: 'regex=^(?!.*\\.md$).*', for: '', order: 'asc' },
              ] as CleanNavigation)
            : ([
                { pattern: '**/*.md', for: '', order: 'asc' },
              ] as CleanNavigation)
        }
      }),
    )

    // Move all nested folders into standalone 'folders' entries
    Object.keys(pagesFiles).map((folder) => {
      if (pagesFiles[folder].navigation) {
        pagesFiles[folder].navigation = extractNestedFolders(
          pagesFiles,
          pagesFiles[folder].navigation as CleanNavigation,
        )
      }
    })

    // Need to sort the pagesFiles after it's populated, as Promise.all
    // will populate it out of order
    pagesFiles = Object.fromEntries(
      Object.keys(pagesFiles)
        .sort(FilesystemHelpers.sortFiles)
        .map((k) => [k, pagesFiles[k]]),
    )

    // Move all sections into standalone 'folders' entries
    Object.keys(pagesFiles).map((folder) => {
      if (pagesFiles[folder].navigation) {
        // Make sure rest/patterns in sections stay relative to the parent directory
        pagesFiles[folder].navigation = applyPatternOrigin(
          folder,
          pagesFiles[folder].navigation as CleanNavigation,
        )
        pagesFiles[folder].navigation = extractNestedSections(
          pagesFiles,
          pagesFiles[folder].navigation as CleanNavigation,
          folder,
        )
      }
    })

    // Get all files and folders not explicitly set in navigation entries
    const remainingFiles = new Set(files)
    const remainingFolders = new Set(folders)

    Object.keys(pagesFiles).forEach((folder) => {
      extractExplicitFilesAndFoldersSet(
        remainingFiles,
        remainingFolders,
        pagesFiles[folder].navigation as CleanNavigation,
      )
    })

    // Resolve all patterns first
    Object.keys(pagesFiles).map((folder) => {
      if (pagesFiles[folder].navigation) {
        pagesFiles[folder].navigation = resolvePatterns(
          pagesFiles[folder].navigation as CleanNavigation,
          remainingFiles,
          remainingFolders,
        )
      }
    })

    // Then resolve rest patterns
    Object.keys(pagesFiles).map((folder) => {
      if (pagesFiles[folder].navigation) {
        pagesFiles[folder].navigation = resolveRestEntries(
          pagesFiles[folder].navigation as CleanNavigation,
          remainingFiles,
          remainingFolders,
        )
      }
    })

    // Add all remaining files and folders to their parent's "excluded" list
    trackExcludedFilesAndFolders(
      markdownFiles,
      pagesFiles as Record<string, PagesFile>,
      remainingFiles,
      remainingFolders,
    )

    // Resolve versioned content
    resolveVersionedContent(pagesFiles as Record<string, PagesFile>)

    // Apply `hidden: true` and `draft: true` recursively to all descendants
    // Apply `indexable` value to descendants if they don't have one
    applyFieldInheritance(pagesFiles as any, pagesFiles['/'] as any)

    return pagesFiles as Record<string, PagesFile>
  },
}
