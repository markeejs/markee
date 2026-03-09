import { PagesCompute } from '../compute/pages.js'

export class PagesCache {
  static loadFolders(files: Record<string, MarkdownFile>) {
    return PagesCompute.navigationStructure(files)
  }

  static clearFile(_file: string) {
    // Noop for now
  }
}
