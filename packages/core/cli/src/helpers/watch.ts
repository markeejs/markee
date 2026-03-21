import fs from 'node:fs'

import { PathHelpers } from './path.js'

type WatchFilename = string | Buffer | null
type WatchHandler = (eventType: string, filename: string | null) => void
type Watcher = { close(): void }

function sanitize(filename: WatchFilename) {
  if (!filename) return null

  return filename
    .toString()
    .replaceAll(PathHelpers.win32.sep, PathHelpers.posix.sep)
}

export const WatchHelpers = {
  watchTree(root: string, handler: WatchHandler): Watcher {
    return fs.watch(root, { recursive: true }, (eventType, filename) =>
      handler(eventType, sanitize(filename)),
    )
  },
}
