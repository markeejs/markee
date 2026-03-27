export interface Configuration {
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

export interface MarkdownFile {
  link: string
  alias?: string[]
  layout: string
  frontMatter: {
    title?: string
    description?: string
    tags?: string[]
    authors?: string[]
    date?: string
    modificationDate?: string
    image?: string
    excerpt: string
    class?: string
    layout?: string
    hidden?: boolean
    indexable?: boolean
    draft?: boolean
    plugins?: Configuration['plugins']
    version?: { name?: string; date?: string }
  }
  revisionDate?: number
  readingTime: number
  root?: string
  payload: {
    [id: string]: {
      [plugin: string]: any
    }
  }
}

export interface SectionFile {
  link?: string
  alias?: string[]
  meta?: MarkdownFile['frontMatter']
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

export interface SearchIndex {
  [file: string]: {
    [anchor: string]: {
      l: string
      lv: string
      c: string[]
    }
  }
}
