import type { MarkdownFile, SectionFile } from '@markee/types'
import { atom, computed } from 'nanostores'
import { $navigationLoader } from './metadata.js'
import { $currentFile } from './current.js'

export interface TreeLeaf {
  key: string
  label: string
  link: string
  hidden: boolean
  parent?: TreeItem
  versionLabel?: string
  outdated?: string
}

export interface TreeItem {
  key: string
  indexKey?: string
  label: string
  collapsible?: boolean
  hidden: boolean
  items?: (TreeItem | TreeLeaf)[]
  canonicalItems?: (TreeItem | TreeLeaf)[]
  link?: string
  canonicalLink?: string
  parent?: TreeItem
  versionLabel?: string
  versions?: (TreeItem | TreeLeaf)[]
  outdated?: string
}

const treeCache = new Map<string, TreeItem | null>()

function isIndex(file: string, folder: string) {
  const folderName = folder.split('/').pop()
  return (
    file === `${folder}/index.md` ||
    file === `${folder}/${folderName}.md` ||
    file === `${folder}.md`
  )
}

function findIndex(folder: string, files: Record<string, MarkdownFile>) {
  const folderName = folder.split('/').pop()
  return [`${folder}/index.md`, `${folder}/${folderName}.md`, `${folder}.md`]
    .map((indexKey) => ({ indexKey, index: files[indexKey] }))
    .find((candidate) => candidate.index)
}

function savedVersion(key: string) {
  return sessionStorage.getItem('markee::versioned-content::' + key)
}

function findFirstLink(root: TreeItem | TreeLeaf) {
  if (root.link) return root.link
  if ('items' in root && root.items?.length)
    return root.items.find(findFirstLink)?.link
}

function computeVersionedContent(
  tree: TreeItem,
  versions: (TreeItem | TreeLeaf)[],
  folder: boolean,
  forceTitle?: string,
) {
  const currentFile = savedVersion(tree.key) ?? $currentFile.get()?.key

  if (folder) {
    const version = (versions.find((version) =>
      currentFile?.startsWith(version.key),
    ) ?? versions[0]) as TreeItem

    tree.canonicalLink = findFirstLink(versions[0] as TreeItem)
    tree.canonicalItems = (versions[0] as TreeItem).items
    tree.link = version.link
    tree.indexKey = version.indexKey
    tree.label = forceTitle || version.label
    tree.items = version.items
    tree.outdated = version !== versions[0] ? tree.canonicalLink : undefined
  } else {
    const version = (versions.find((version) => version.key === currentFile) ??
      versions[0]) as TreeLeaf
    tree.key = version.key
    tree.link = version.link
    tree.label = forceTitle || version.label
    tree.outdated = version !== versions[0] ? versions[0].link : undefined
  }
}

function computeLeaf(
  key: string,
  file: MarkdownFile,
  title?: string,
): TreeLeaf | null {
  return {
    key,
    hidden: !!file.frontMatter?.hidden,
    label: title || file.frontMatter?.title || '',
    versionLabel: file.frontMatter?.version?.name,
    link: file.link,
  }
}

function computeTree(
  key: string,
  root: SectionFile,
  title: string | undefined,
  folders: Record<string, SectionFile>,
  files: Record<string, MarkdownFile>,
): TreeItem | null {
  if (!root || !folders[key]) {
    return null
  }

  const collapsible = root.collapsible
  const treatItem = (item: (typeof root.navigation)[number]) => {
    const file = files[item.key]
    const folder = folders[item.key]

    if (file) {
      return computeLeaf(item.key, file, item.title)
    }

    if (folder) {
      return computeTree(item.key, folder, item.title, folders, files)
    }

    if (item.key.startsWith('http://') || item.key.startsWith('https://')) {
      return computeLeaf(
        item.key,
        {
          link: item.key,
          layout: '',
          frontMatter: { excerpt: '' },
          readingTime: 0,
          payload: {},
        },
        item.title,
      )
    }
  }

  const allItems = root.navigation
    .map(treatItem)
    .filter((file): file is NonNullable<typeof file> => !!file)
  const hiddenItems = (root.excluded ?? [])
    .filter((file) => !!file)
    .map(treatItem)
    .filter((file): file is NonNullable<typeof file> => !!file)
    .map((item) => {
      item.hidden = true
      return item
    })
  const versionItems = root.versions
    ?.filter((file) => !!file)
    .map(treatItem)
    .filter((file): file is NonNullable<typeof file> => !!file)

  const { index, indexKey } = findIndex(key, files) ?? {}
  const items = [...allItems, ...hiddenItems].filter(
    (item) => !isIndex(item.key, key),
  )
  const indexItem = [...allItems, ...hiddenItems].find((item) =>
    isIndex(item.key, key),
  ) ?? { label: index?.frontMatter?.title }
  const link = index?.link

  if (!index && !items.length && !root.versions?.length) {
    return null
  }

  const label =
    title || root.title || indexItem?.label || root.inferredTitle || ''

  const treeItem = {
    key,
    indexKey,
    label,
    items: items.length ? items : undefined,
    link,
    hidden: !!root.hidden,
    versions: versionItems,
    versionLabel: root?.version?.name,
    ...(collapsible !== undefined ? { collapsible } : {}),
  }

  if (versionItems?.length) {
    computeVersionedContent(
      treeItem,
      versionItems,
      !!root.version?.folder,
      title || root.title,
    )
  }

  treeCache.set(key, treeItem)
  if (treeItem.indexKey) {
    treeCache.set(treeItem.indexKey, treeItem)
  }

  treeItem.items?.forEach((item) => {
    item.parent = treeItem
    treeCache.set(item.key, item)
  })
  return treeItem
}

function getAncestors(
  item?: TreeItem | TreeLeaf | null,
): (TreeItem | TreeLeaf)[] {
  if (!item) return []
  return [...getAncestors(item.parent), item]
}

const $burst = atom({})

export const $navigationTree = computed(
  [$navigationLoader, $currentFile, $burst],
  ({ data }) => {
    const { files, folders } = data || {
      files: {} as Record<string, MarkdownFile>,
      folders: {} as Record<string, SectionFile>,
    }
    treeCache.clear()

    const tree = computeTree('/', folders['/'], '', folders, files)

    return {
      ...tree,
      getBranchByKey(key: string) {
        return treeCache.get(key) ?? null
      },
      getAncestorsForKey(key: string) {
        return getAncestors(treeCache.get(key))
      },
      reload() {
        $burst.set({})
      },
    }
  },
)
