declare var config: Configuration & {
  sources: {
    root: string
    mount?: string
    layout?: string
  }[]
  server: {
    host: string
    port: number
  }
  build: {
    outDir: string
    splits?: Record<string, string>
    skipLinkValidation?: boolean
    rss?: Record<
      string,
      {
        filter: {
          folder?: string
          author?: string | string[]
          tag?: string | string[]
        }
        settings: {
          site: string
          title: string
          description?: string
          size?: number
          language?: string
          managingEditor?: string
          webMaster?: string
        }
      }
    >
    sitemap?: {
      site: string
    }
  }
  watch?: string[]
  extensions?: string[]
}

declare var mode: 'preview' | 'production'
declare var command: 'develop' | 'build' | 'serve' | 'init'

declare var window: any
