import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { PathHelpers } from '../helpers/path.js'
import { DeprecationCompute } from '../compute/deprecation.js'

const fileCache = new Map<string, string>()

export class FileCache {
  static async readFile(file: string, key: string) {
    const content = fileCache.get(key) || (await fs.readFile(file, 'utf-8'))
    fileCache.set(key, content)

    return content
  }

  static async readProjectFile(file: string) {
    let path = file
    if (path.startsWith('/_assets/_extension/')) {
      const extensionPath = path.slice('/_assets/_extension/'.length)
      path = new URL(import.meta.resolve(extensionPath)).pathname
    } else {
      path = PathHelpers.concat(ROOT_DIR, path)
    }

    return await this.readFile(path, file)
  }

  static clearFile(file: string) {
    fileCache.delete(file)
  }

  static clearAll() {
    fileCache.clear()
  }
}
