import './prism'

declare global {
  interface Configuration {
    title?: string
    titleTemplate?: string
    theme?: string
    repository?: string
    repositoryRoot?: string
    autoAppend?: string[]
    development?: boolean
    plugins?: {
      fileInclude?: {
        includeCharacter: string
      }
      tabbedContent?: {
        linkTabs?: boolean
      }
      prism?: {
        aliases?: Record<string, string>
      }
      lightbox?:
        | boolean
        | {
            enabled?: boolean
          }
    }
    redirects?: Record<string, string>
  }

  interface Frontmatter {
    // Generic
    title?: string
    description?: string
    tags?: string[]

    // Blog-related
    authors?: string[]
    date?: string
    modificationDate?: string
    image?: string
    excerpt: string

    // Configuration
    class?: string
    layout?: string
    hidden?: boolean
    indexable?: boolean
    draft?: boolean
    plugins?: Configuration['plugins']

    // Versioning
    version?: { name?: string; date?: string }
  }

  interface MarkdownFile {
    link: string
    alias?: string[]
    layout: string
    frontMatter: Frontmatter
    revisionDate?: number
    readingTime: number
    root?: string
    payload: {
      [id: string]: {
        [plugin: string]: any
      }
    }
  }

  interface PagesFile {
    link?: string
    alias?: string[]
    meta?: Frontmatter
    title?: string
    inferredTitle?: string
    collapsible?: boolean
    hidden?: boolean
    indexable?: boolean
    draft?: boolean
    navigation: {
      key: string
      title?: string
      split?: boolean
    }[]
    excluded?: {
      key: string
      title?: string
      split?: boolean
    }[]
    version?: {
      folder?: boolean
      name?: string
      date?: string
      latestPathAlias?: string
    }
    versions?: {
      key: string
      split?: boolean
    }[]
  }

  interface SearchIndex {
    [file: string]: {
      [anchor: string]: {
        l: string
        lv: string
        c: string[]
      }
    }
  }

  interface SearchResult {
    file: string
    results: {
      label: string
      anchor: string
      content: string
    }[]
  }

  interface SearchData {
    id: string
    key: string
    tags: string[]
    content: string
    title: string
    label: string
    info: {
      anchor: string
      content: string
      label: string
    }
  }

  interface TreeLeaf {
    key: string
    label: string
    link: string
    hidden: boolean
    parent?: TreeItem
    versionLabel?: string
    outdated?: string
  }

  interface TreeItem {
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

  type PrismTheme =
    | 'oneLight'
    | 'oneDark'
    | 'default'
    | 'coy'
    | 'dark'
    | 'funky'
    | 'okaidia'
    | 'solarizedlight'
    | 'tomorrow'
    | 'twilight'

  var command: 'build' | 'develop' | 'serve' | undefined
}

declare module 'unified' {
  interface Data {
    config?: Configuration | null
    frontMatter?: MarkdownFile['frontMatter']
    pluginConfig: <T = any>(pluginName: string) => T | undefined
  }
}
