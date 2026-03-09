import { state } from '@markee/state'
import { compareLink } from './compare-link.js'

function isIndex(file: string, folder: string) {
  const folderName = folder.split('/').pop()
  return (
    file === `${folder}/index.md` ||
    file === `${folder}/${folderName}.md` ||
    file === `${folder}.md`
  )
}

export function isItem(item: TreeItem | TreeLeaf, path: string): boolean {
  return item.key === path || ('indexKey' in item && item.indexKey === path)
}

export function getVersionedFolderFileLink(
  currentVersion: TreeItem | PagesFile,
  targetVersion: TreeItem | PagesFile,
  link: string,
) {
  return link.replace(currentVersion.link!, targetVersion.link!)
}

export function containsItem(item: TreeItem | TreeLeaf, path: string): boolean {
  if ('versions' in item && item?.versions?.length) {
    return !!item.versions?.some((child) => containsItem(child, path))
  }

  if ('items' in item) {
    return (
      isIndex(path, item.key) ||
      (item.items?.some((child) => containsItem(child, path)) ?? false)
    )
  }

  return isItem(item, path)
}

export function filterItem(
  item: TreeItem | TreeLeaf | undefined,
  filter: string,
): (TreeItem | TreeLeaf)[] {
  if (!item) return []

  filter = filter.toLowerCase()
  const isSelected = item.label?.toLowerCase().includes(filter)
  const items =
    'items' in item
      ? item.items?.flatMap((child) => filterItem(child, filter))
      : null

  if (isSelected && !items?.length) return [item]
  if (items?.length) return [{ ...item, items }]
  return []
}

export function getFileFromLink(path: string) {
  const navigation = state.$navigation.get()
  const file = Object.entries(navigation.files).find(
    ([, info]) =>
      compareLink(info.link, path) ||
      info.alias?.some((link) => compareLink(link, path)),
  )

  if (!file) return null

  return {
    key: file[0],
    ...file[1],
  }
}
