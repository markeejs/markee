import os from 'node:os'
import colors from 'colors/safe.js'

import { ROOT_DIR } from '../constants.js'

import { PathHelpers } from './path.js'
import { WatchHelpers } from './watch.js'
import { ProcessHelpers } from './process.js'

import { BustCache } from '../cache/bust-cache.js'
import { FileCache } from '../cache/file-cache.js'
import { SectionCache } from '../cache/section-cache.js'
import { ConfigCache } from '../cache/config-cache.js'
import { MarkdownCache } from '../cache/markdown-cache.js'
import { ExtensionsCache } from '../cache/extensions-cache.js'

const platform = os.platform()
export const FilesystemHelpers = {
  /**
   * Helper for generating an error logger with a multi-part message
   * @param parts - message to log before the actual error
   */
  handleCopyError(...parts: string[]) {
    return (e: Error) => {
      console.error(...parts)
      console.error(e)
    }
  },

  /**
   * Helper function for copying an entire directory at the OS level,
   * rather than file-by-file through the FS module.
   * Implementation depends on the underlying OS
   * @param src - folder to copy
   * @param dest - destination folder
   */
  async copyDirectory(src: string, dest: string): Promise<void> {
    if (platform === 'win32') {
      // Use robocopy on Windows
      // /E - copy subdirectories including empty ones
      // The /NFL etc. are to suppress output
      await ProcessHelpers.execFile(
        'robocopy',
        [
          src,
          dest,
          '/IS',
          '/IT',
          '/E',
          '/NFL',
          '/NDL',
          '/NJH',
          '/NJS',
          '/NC',
          '/NS',
        ],
        {
          acceptExitCode: (code) => code < 8,
        },
      )
    } else {
      // Use mkdir -p and cp -R on Unix
      await ProcessHelpers.execFile('mkdir', ['-p', dest])
      await ProcessHelpers.execFile('cp', ['-R', src, dest + PathHelpers.sep])
    }
  },

  /**
   * Sort filenames alphabetically by respecting numeric ordering
   * @param a - first file
   * @param b - second file
   */
  sortFiles(a: string, b: string) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  },

  /**
   * Generate a filesystem watcher watching for the current project, as well as
   * any additional configured sources.
   * On each file change, the file cache is cleared and a debounced event is
   * scheduled. On debounced events, the passed handler is called.
   * @param handler - callback called when a watched file changed
   */
  fileWatcher(handler: () => void) {
    const changeSet = new Set<string>()
    let debounce: NodeJS.Timeout | null = null

    function debouncedFileChangeEvent() {
      // Call the handler
      handler()

      // Log changed files with a cut-off of 10 files named
      const files = [...changeSet]
      changeSet.clear()

      const display = files.slice(0, 10)
      const more = files.slice(10)
      display.forEach((file) =>
        console.log('File updated:', colors.gray(colors.bold(file))),
      )
      if (more.length) {
        console.log('... and', more.length, 'more')
      }
    }

    function queueFileChangeEvent(filename: string) {
      changeSet.add(filename)
      clearTimeout(debounce!)
      debounce = setTimeout(debouncedFileChangeEvent, 200)
    }

    function watch(root: string) {
      return async (_: unknown, filename: string | null) => {
        if (
          filename &&
          !filename.endsWith('~') &&
          !filename.startsWith('.git/') &&
          !filename.startsWith('.git\\') &&
          !filename.startsWith('node_modules') &&
          !filename.startsWith(ConfigCache.config.build.outDir + '/') &&
          !filename.startsWith(ConfigCache.config.build.outDir + '\\')
        ) {
          filename = PathHelpers.concat(root, filename)

          BustCache.clearAll()
          BustCache.clearFile(PathHelpers.concat(ROOT_DIR, filename))
          FileCache.clearFile(filename)
          SectionCache.clearFile(filename)
          MarkdownCache.clearFile(filename)

          if (filename.includes('_assets')) {
            FileCache.clearAll()
          }

          if (
            ['/markee.yaml', '/markee.yml', '/.markeerc'].includes(filename)
          ) {
            await ConfigCache.loadConfig(ROOT_DIR)
            FileCache.clearAll()
            ExtensionsCache.clearAll()
          }

          queueFileChangeEvent(filename)
        }
      }
    }

    const watcher = WatchHelpers.watchTree(ROOT_DIR, watch('/'))
    const watchers = ConfigCache.config.watch?.map((w) =>
      WatchHelpers.watchTree(PathHelpers.concat(ROOT_DIR, w), watch(w)),
    )

    return () => {
      watcher.close()
      watchers?.forEach((w) => w.close())
    }
  },
}
