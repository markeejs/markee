import { computed } from 'nanostores'
import { state } from '@markee/state'

function flattenTree(tree: TreeItem | null): (TreeItem | TreeLeaf)[] {
  if (!tree) return []
  if (tree.items) return [tree, ...tree.items.flatMap(flattenTree)]
  return [tree]
}

export const $siblings = computed(
  [state.$currentLoader, state.$navigation],
  (current, { files, tree }) => {
    const key = current.data?.key
    if (!key) return { previous: null, next: null }

    const file = tree.getBranchByKey(key)
    if (!file) return { previous: null, next: null }

    const flat = flattenTree(tree as TreeItem).filter(
      (item) => item.link && !item.hidden,
    ) as TreeItem[]
    const index = flat.indexOf(file)

    const previousKey = flat[index - 1]?.indexKey ?? flat[index - 1]?.key
    const nextKey = flat[index + 1]?.indexKey ?? flat[index + 1]?.key

    const previousFile = files[previousKey]
    const nextFile = files[nextKey]

    return {
      previous: { key: previousFile && previousKey, file: previousFile },
      next: { key: nextFile && nextKey, file: nextFile },
    }
  },
)
