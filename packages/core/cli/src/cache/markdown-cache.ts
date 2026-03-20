import { globby } from 'globby'

import type { Token } from '../compute/markdown/tokenizer/index.js'

import { ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'

import { FileCache } from './file-cache.js'
import { ConfigCache } from './config-cache.js'

import { MarkdownCompute } from '../compute/markdown.js'
import { MetadataCompute } from '../compute/metadata.js'
import { DeprecationCompute } from '../compute/deprecation.js'

class MarkdownFileCache {
  stale = {
    raw: true,
    resolved: true,
    tokens: true,

    sanitized: true,
    frontMatter: true,
    search: true,
  }
  promise = {
    raw: undefined as Promise<string> | undefined,
    resolved: undefined as Promise<string> | undefined,
    tokens: undefined as Promise<Token[]> | undefined,
    sanitized: undefined as Promise<string> | undefined,
    frontMatter: undefined as Promise<Frontmatter> | undefined,
    search: undefined as Promise<SearchIndex[string]> | undefined,
  }

  raw: string = ''
  resolved: string = ''
  tokens: Token[] = []

  sanitized: string = ''
  frontMatter: Frontmatter = { excerpt: '' }
  search: SearchIndex[string] = {}

  links = new Set<string>()
  linksData = new Map<
    string,
    {
      version?: 'latest' | 'fixed'
      line: number
      offset: number
      length: number
      file: string
    }[]
  >()
  payload: Record<string, Record<string, unknown>> = {}

  constructor(private path: string) {}

  markAsStale(path: string) {
    if (path === this.path) {
      this.stale.raw = true
    }
    this.stale.resolved = true
  }

  async revalidate<
    Field extends
      | 'raw'
      | 'resolved'
      | 'tokens'
      | 'sanitized'
      | 'frontMatter'
      | 'search',
    Value extends this[Field],
  >({
    field,
    get,
    bust = [],
  }: {
    field: Field
    get: () => Promise<Value>
    bust?: (
      | 'raw'
      | 'resolved'
      | 'tokens'
      | 'sanitized'
      | 'frontMatter'
      | 'search'
    )[]
  }) {
    if (this.stale[field]) {
      this.promise[field] ??= get() as any
      const next = await (this.promise[field]! as Promise<this[Field]>)
      delete this.promise[field]
      if (this[field] !== next) {
        bust.forEach((s) => (this.stale[s] = true))
        this[field] = next
      }
    }
    this.stale[field] = false
    return this[field]!
  }

  async readFromDisk() {
    return this.revalidate({
      field: 'raw',
      bust: ['resolved'],
      get: async () => {
        return DeprecationCompute.convertDeprecatedSyntaxes(
          await FileCache.readProjectFile(this.path),
        )
      },
    })
  }

  async resolveInclusions(visited: string[] = []) {
    await this.readFromDisk()

    return this.revalidate({
      field: 'resolved',
      bust: ['tokens'],
      get: async () =>
        await MarkdownCompute.inclusions(this.path, this.raw, visited),
    })
  }

  async tokenize() {
    await this.resolveInclusions()

    return this.revalidate({
      field: 'tokens',
      bust: ['sanitized', 'frontMatter', 'search'],
      get: async () => MarkdownCompute.tokens(this.resolved),
    })
  }

  async getFrontMatter() {
    await this.tokenize()

    return this.revalidate({
      field: 'frontMatter',
      get: async () =>
        MarkdownCompute.frontMatter(this.tokens, {
          file: this.path,
          folder: PathHelpers.dirname(this.path),
          splits: ConfigCache.getSplits(),
        }),
    })
  }

  async sanitize() {
    await this.readFromDisk()
    await this.tokenize()
    await this.getFrontMatter()

    return this.revalidate({
      field: 'sanitized',
      get: async () => {
        this.links.clear()
        this.linksData.clear()
        this.payload = {}

        return await MarkdownCompute.sanitizedContent(
          this.resolved,
          this.tokens,
          {
            links: this.links,
            linksData: this.linksData,
            splits: ConfigCache.getSplits(),
            payload: this.payload,
            frontMatter: this.frontMatter,
          },
        )
      },
    })
  }

  async index() {
    await this.tokenize()
    await this.getFrontMatter()

    return this.revalidate({
      field: 'search',
      get: async () =>
        MarkdownCompute.searchIndex(this.tokens, {
          title: this.frontMatter.title ?? '',
        }),
    })
  }

  async getBrokenLinks(folders: Record<string, SectionFile>) {
    await this.getFrontMatter()
    await this.sanitize()

    return MarkdownCompute.brokenLinks({
      source: this.resolved,
      folders,
      links: this.links,
      linksData: this.linksData,
      frontMatter: this.frontMatter,
    })
  }

  async getReadingTime() {
    await this.readFromDisk()

    return MarkdownCompute.readingTime(this.raw)
  }
}

export class MarkdownCache {
  static files = new Map<string, MarkdownFileCache>()
  static get(file: string) {
    const data = this.files.get(file) ?? new MarkdownFileCache(file)
    this.files.set(file, data)
    return data
  }
  static clearFile(file: string) {
    this.files.forEach((data) => data.markAsStale(file))
  }
  static async loadFiles() {
    const files: Record<string, MarkdownFile> = {}

    await Promise.all(
      config.sources.map(async (source) => {
        const found = await globby('**/*.md', {
          cwd: PathHelpers.concat(ROOT_DIR, ConfigCache.getRoot(source.root)),
        })

        found.forEach((file) => {
          const { path, data } = MarkdownCompute.initialFileData(file, source)
          this.get(path)
          files[path] = data
        })
      }),
    )

    return files
  }
  static async loadMetadata(
    files: Record<string, MarkdownFile>,
    folders: Record<string, SectionFile>,
  ) {
    const assetsPages: SectionFile = {
      indexable: false,
      navigation: [],
    }
    await Promise.all(
      Object.keys(files).map(async (file) => {
        if (!file.startsWith('/_assets')) {
          files[file].frontMatter =
            await MarkdownCache.get(file).getFrontMatter()
          files[file].readingTime =
            await MarkdownCache.get(file).getReadingTime()
        } else {
          assetsPages.navigation.push({
            key: file,
            title: ' ',
          })
        }
        files[file].payload = MarkdownCache.get(file).payload
      }),
    )

    await MetadataCompute.frontMatterInheritance(files, folders)
    MetadataCompute.versionedContentOrdering(files, folders)
  }
  static async getAllBrokenLinks(
    files: Record<string, MarkdownFile>,
    folders: Record<string, SectionFile>,
  ) {
    const brokenLinks = await Promise.all(
      Object.keys(files).map((file) => this.reportBrokenLinks(file, folders)),
    )
    return brokenLinks.reduce((acc, curr) => acc + curr, 0)
  }
  static async reportBrokenLinks(
    key: string,
    folders: Record<string, SectionFile>,
  ) {
    return MarkdownCompute.reportBrokenLinks(
      key,
      await this.get(key).getBrokenLinks(folders),
    )
  }
}
