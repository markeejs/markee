import { SectionCompute } from '../compute/section.js'

export class SectionCache {
  static loadFolders(files: Record<string, MarkdownFile>) {
    return SectionCompute.navigationStructure(files)
  }

  static clearFile(_file: string) {
    // Noop for now
  }
}
