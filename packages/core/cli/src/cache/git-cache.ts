import { exec, execSync } from 'child_process'
import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'

let ROOT_GIT = ROOT_DIR
try {
  ROOT_GIT = execSync('git rev-parse --show-toplevel', {
    stdio: ['pipe', 'pipe', 'ignore'],
  })
    .toString('utf-8')
    .trim()
} catch (err) {
  void err
}

/**
 * Get the last known revision dates for multiple files from Git.
 * @returns A promise that resolves with the revision dates.
 */
function getLastRevisionDates() {
  return new Promise<Record<string, number | null>>((resolve) => {
    const cmd = `git log --name-only --date=default --pretty=format:'%ad' '*.md'`

    exec(cmd, (error, stdout) => {
      if (error) {
        resolve({})
        return
      }

      const lines = stdout.trim().split('\n')
      const fileDates: Record<string, number | null> = {}

      let currentDate = null
      for (const line of lines) {
        if (line?.endsWith('.md')) {
          // Ensure that only the latest date is saved for each file
          if (!fileDates[line]) {
            fileDates[line] = currentDate
          }
        } else if (line) {
          currentDate = new Date(line).valueOf()
        }
      }

      resolve(fileDates)
    })
  })
}

let revisionDatePromise = getLastRevisionDates()

export class GitCache {
  /**
   * Extract the revision date for a given file
   * @param filePath - path of the file to get the revision date for
   */
  static async getRevisionDate(filePath: string) {
    const files = await revisionDatePromise
    const relativePath = PathHelpers.relative(
      ROOT_GIT,
      PathHelpers.concat(ROOT_DIR, filePath),
    )

    return (
      files[relativePath] ??
      (
        await fs
          .stat(PathHelpers.concat(ROOT_DIR, filePath))
          .catch(() => ({ mtimeMs: 0 }))
      ).mtimeMs
    )
  }
}
