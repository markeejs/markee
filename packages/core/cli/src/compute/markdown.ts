import fs from 'fs-extra'
import yaml from 'yaml'
import color from 'colors/safe.js'
import GithubSlugger from 'github-slugger'
import { readingTime } from 'reading-time-estimator'

import { ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'

import { FileCache } from '../cache/file-cache.js'
import { ConfigCache } from '../cache/config-cache.js'
import { MarkdownCache } from '../cache/markdown-cache.js'

import { SimpleTokenizer, type Token } from './markdown/tokenizer/index.js'
import { ExtensionsCache } from '../cache/extensions-cache.js'

/* Metadata */

/**
 * Read a source configuration and infer the default layout to use, if not
 * specified. Default layouts inferred by source name are 'pages' and 'blog'.
 * All other source names use the 'docs' as default layout
 * @param source - source definition
 */
function inferDefaultLayout(source: (typeof config)['sources'][number]) {
  const sourceRoot = ConfigCache.getRoot(source.root)
  return { pages: 'pages', blog: 'blog' }[sourceRoot as 'pages'] ?? 'docs'
}

/**
 * Take a file and a root, and infer the link to be used for that file
 * @param file - file path to generate the link for
 * @param root - root on which the file is mounted
 * @param mount - optional override for the root
 */
function getFileLink(file: string, root: string, mount?: string) {
  const withoutExt = file.slice(0, -'.md'.length)
  const withoutIndex = removeIndexAndSameFilename(withoutExt)
  return PathHelpers.concat('/', mount ?? root, withoutIndex)
}

/**
 * Take a file path, and removes any trailing /index or same-name:
 * /some/folder/index(.md) -> /some/folder
 * /some/folder/folder(.md) -> /some/folder
 * /some/folder/file(.md) -> /some/folder/file
 * @param path - path to modify
 */
function removeIndexAndSameFilename(path: string) {
  const parts = path.split('/')

  if (
    parts[parts.length - 1] === 'index' ||
    parts[parts.length - 1] === parts[parts.length - 2]
  ) {
    parts.pop()
  }

  return parts.join('/')
}

/* Inclusions */
type IncludeArgs = {
  start?: string
  end?: string
  [k: string]: unknown
}

type IncludeOpts = {
  start?: string
  end?: string
  shouldIndent: boolean
  shouldRewriteLinks: boolean
  shouldPreserveDelimiters: boolean
}

function getIncludeOpts(args: IncludeArgs): IncludeOpts {
  return {
    start: typeof args.start === 'string' ? args.start : undefined,
    end: typeof args.end === 'string' ? args.end : undefined,
    shouldIndent: (args['preserve-includer-indent'] as unknown) !== false,
    shouldRewriteLinks: (args['rewrite-relative-urls'] as unknown) !== false,
    shouldPreserveDelimiters:
      (args['preserve-delimiters'] as unknown) !== false,
  }
}

function sliceBetweenDelimiters(
  input: string,
  opts: Pick<IncludeOpts, 'start' | 'end' | 'shouldPreserveDelimiters'>,
): string {
  let out = input

  if (opts.start) {
    const i = out.indexOf(opts.start)
    if (i > -1) {
      out = out.slice(i)
      if (!opts.shouldPreserveDelimiters) out = out.slice(opts.start.length)
    }
  }

  if (opts.end) {
    const i = out.indexOf(opts.end)
    if (i > -1) {
      out = out.slice(0, i)
      if (opts.shouldPreserveDelimiters) out += opts.end
    }
  }

  return out
}

function trimOuterBlankLines(input: string): string {
  const lines = input.split('\n')
  const first = lines.findIndex((l) => !!l.trim())
  if (first === -1) return ''
  const lastFromEnd = [...lines].reverse().findIndex((l) => !!l.trim())
  return lines.slice(first, lastFromEnd ? -lastFromEnd : undefined).join('\n')
}

function indentBlock(
  input: string,
  indent: string,
  shouldIndent: boolean,
): string {
  if (!shouldIndent) return input
  return input
    .split('\n')
    .map((l) => `${indent}${l}`)
    .join('\n')
}

async function resolveIncludeMarkdown({
  include,
  file,
  visited,
}: {
  include: {
    'start'?: string
    'end'?: string
    'indent'?: string
    'include'?: string
    'include-markdown'?: string
    'preserve-delimiters'?: boolean
    'preserve-includer-indent'?: boolean
    'rewrite-relative-urls'?: boolean
  }
  file: string
  visited: string[]
}): Promise<{ text: string; directory?: string; file?: string }> {
  const opts = getIncludeOpts(include)

  const origin = (include['include-markdown'] || include['include']) as string
  let originFile =
    origin && PathHelpers.resolve(PathHelpers.dirname(file), origin)

  if (!file.startsWith('/'))
    originFile = PathHelpers.relative(ROOT_DIR, originFile)

  let originFilePath = originFile
  if (originFilePath.startsWith('/_assets/_extension/')) {
    const extensionFile = originFilePath.slice('/_assets/_extension/'.length)
    originFilePath = new URL(import.meta.resolve(extensionFile)).pathname
  } else {
    originFilePath = PathHelpers.concat(ROOT_DIR, originFilePath)
  }
  const originFileExists = originFilePath && fs.pathExistsSync(originFilePath)

  if (!originFileExists) {
    console.log(
      'Cannot find included file with origin',
      origin,
      'in file',
      file,
    )
    console.log('Include will be ignored.')
    return { text: '' }
  }

  if (visited.includes(originFile)) {
    console.log(
      'Detected loop following',
      ['', ...visited, file].join('\n   -> '),
    )
    console.log('All further includes down this path will be ignored')
    return { text: '' }
  }

  let originContent: string
  if (originFile.endsWith('.md')) {
    originContent =
      await MarkdownCache.get(originFile).resolveInclusions(visited)
  } else {
    originContent = await FileCache.readProjectFile(originFile)
  }

  originContent = sliceBetweenDelimiters(originContent, opts)
  originContent = trimOuterBlankLines(originContent)
  originContent = indentBlock(originContent, include.indent!, opts.shouldIndent)

  return {
    text: originContent,
    directory: PathHelpers.dirname(opts.shouldRewriteLinks ? originFile : file),
    file: opts.shouldRewriteLinks ? originFile : file,
  }
}

async function resolveIncludeSelf({
  include,
  content,
}: {
  include: {
    'start'?: string
    'end'?: string
    'indent'?: string
    'preserve-delimiters'?: boolean
    'preserve-includer-indent'?: boolean
  }
  content: string
}): Promise<{ text: string }> {
  const opts = getIncludeOpts(include)

  let originContent = content
  originContent = sliceBetweenDelimiters(originContent, opts)
  originContent = trimOuterBlankLines(originContent)
  originContent = indentBlock(originContent, include.indent!, opts.shouldIndent)

  return { text: originContent }
}

function splitAroundIncludes(content: string): {
  'text': string
  'include'?: string
  'include-self'?: string
  'include-markdown'?: string
  'start'?: string
  'end'?: string
  'indent'?: string
  'preserve-delimiters'?: boolean
  'preserve-includer-indent'?: boolean
  'rewrite-relative-urls'?: boolean
}[] {
  const delimiter = config.plugins?.fileInclude?.includeCharacter ?? '!'
  const regex = new RegExp(
    `\\{${delimiter}([\\s\\S]*?include[\\s\\S]*?)${delimiter}}`,
  )
  return content.split(regex).map((part, i, a) => {
    const isInclude = i % 2

    if (isInclude) {
      const previous = a[i - 1]

      const args = Object.fromEntries(
        part
          .split('\n')
          .map(
            (p) =>
              p
                .trim()
                .match(/(.*?)[= \t]+(.*)/)
                ?.slice(1, 3) || [p.trim(), 'true'],
          )
          .filter((p) => !!p[0])
          .map((p) => [p[0], JSON.parse(p[1])]),
      )
      args.indent = ' '.repeat(previous.split('\n').at(-1)?.length || 0)
      return args as { text: string }
    }

    return { text: part }
  })
}

function computeOriginIndices(
  includes: {
    text: string
    directory?: string
    file?: string
  }[],
  defaultFile: string,
  defaultDirectory: string,
) {
  let start = 0
  return (
    '\n<!-- markee:origin-indices:' +
    JSON.stringify(
      includes
        .map((i) => ({
          start: (start += i.text.length) - i.text.length,
          directory: i.directory ?? defaultDirectory,
          file: i.file ?? defaultFile,
        }))
        .flatMap((e, i, a) => (a[i - 1]?.file === e.file ? [] : [e])),
    ) +
    ' -->'
  )
}

async function resolveMarkdownInclusions(
  file: string,
  content: string,
  visited: string[] = [],
) {
  let includes = splitAroundIncludes(content)

  // Pass 1: resolve everything except include-self
  includes = await Promise.all(
    includes.map((include) => {
      if (include['include'] || include['include-markdown']) {
        return resolveIncludeMarkdown({ include, file, visited })
      }
      return include
    }),
  )

  // Pass 2: resolve include-self after the first pass has mutated tokens/text elsewhere
  includes = await Promise.all(
    includes.map((include) => {
      if (include['include-self']) {
        return resolveIncludeSelf({
          include,
          content: includes.map((i) => i.text).join(''),
        })
      }
      return include
    }),
  )

  const resolved = includes.map((i) => i.text).join('')
  return (
    resolved + computeOriginIndices(includes, file, PathHelpers.dirname(file))
  )
}

/* Front-matter */
function indent(value: string) {
  return value
    .split('\n')
    .map((l) => `   ${l}`)
    .join('\n')
}

function sanitizeFrontMatterValues(frontMatter: Frontmatter) {
  if ('author' in frontMatter) {
    frontMatter.authors = [
      ...(frontMatter.authors ?? []),
      ...(Array.isArray(frontMatter.author)
        ? frontMatter.author
        : [frontMatter.author as string]),
    ].filter((a) => a)
    delete frontMatter.author
  }

  if ('authors' in frontMatter && !Array.isArray(frontMatter.authors)) {
    frontMatter.authors = [frontMatter.authors as unknown as string]
  }

  if ('tags' in frontMatter && !Array.isArray(frontMatter.tags)) {
    frontMatter.tags = [frontMatter.tags as unknown as string]
  }

  if ('hide' in frontMatter && !('hidden' in frontMatter)) {
    frontMatter.hidden = !!frontMatter.hide
  }

  return frontMatter
}

function parseFrontMatter(fm: string, file: string): Frontmatter {
  let frontMatter: Frontmatter
  try {
    frontMatter = yaml.parse(fm)
  } catch (err) {
    void err
    console.log(
      color.yellow('Non-YAML front-matter content found at'),
      color.bold(color.gray(file)),
    )
    try {
      frontMatter = yaml.parse('default: ' + fm)
      console.log(
        color.yellow('Front-matter will be parsed as YAML:\n') +
          color.gray(indent(`default: ${fm}`)),
      )
    } catch (err) {
      void err
      frontMatter = fm as any
      console.log(
        color.yellow('Front-matter will be parsed as a string entry:\n') +
          color.green(indent(`"${fm}"`)),
      )
    }
  }

  if (typeof frontMatter !== 'object' || Array.isArray(frontMatter)) {
    frontMatter = { default: frontMatter } as any
  }

  return frontMatter ?? ({} as Frontmatter)
}

/* Sanitation */
interface Split {
  root: string
  folder: string
}

function removeDrafts(content: string, tokens: Token[]) {
  if (mode === 'preview') return content

  const drafts = tokens.filter(
    (t) => t.type === 'directive_container_open' && t.meta.name === 'draft',
  )
  const lines = content.split('\n')
  return lines
    .map((l, i) => {
      const draft = drafts.find((d) => i >= d.map[0] && i <= d.map[1])
      if (draft) {
        return l.slice(0, draft.contentOffset[i - draft.map[0]])
      }
      return l
    })
    .join('\n')
}

function splitAroundLinks(content: string, links: NonNullable<Token['links']>) {
  const lineStarts: number[] = [0]
  for (let i = 0; i < content.length; i++) {
    if (content.at(i) === '\n') lineStarts.push(i + 1)
  }

  const spans: { s: number; e: number }[] = []

  for (const l of links) {
    const lineStart = lineStarts[l.line]
    let lineEnd =
      l.line + 1 < lineStarts.length ? lineStarts[l.line + 1] : content.length
    if (lineEnd > lineStart && content.at(lineEnd - 1) === '\n') lineEnd -= 1
    if (lineEnd > lineStart && content.at(lineEnd - 1) === '\r') lineEnd -= 1
    spans.push({ s: lineStart + l.start, e: lineStart + l.end })
  }

  spans.sort((a, b) => a.s - b.s || a.e - b.e)

  const out: string[] = []
  let cursor = 0

  for (const sp of spans) {
    if (sp.s < cursor) continue
    out.push(content.slice(cursor, sp.s))
    out.push(content.slice(sp.s, sp.e))
    cursor = sp.e
  }

  out.push(content.slice(cursor))
  return out
}

function sanitizeLink(p: string) {
  p = p.replaceAll(PathHelpers.win32.sep, PathHelpers.posix.sep)
  if (p.startsWith(':/', 1)) return p.slice(2)
  return p
}

function resolveLink(
  link: string,
  links: Set<string>,
  folder: string,
  splits: Split[],
) {
  if (
    link &&
    !link.startsWith('http://') &&
    !link.startsWith('https://') &&
    !link.startsWith('mailto:') &&
    !link.startsWith('data:') &&
    !link.startsWith('#')
  ) {
    const resolved = sanitizeLink(PathHelpers.resolve(folder, link))
    const split = splits.find((s) => resolved.startsWith(s.folder))
    let [beforeHash] = resolved.split('#')
    beforeHash = beforeHash.endsWith('/') ? beforeHash.slice(0, -1) : beforeHash

    links.add(beforeHash)

    return {
      link:
        split && global.command === 'build' && !beforeHash.endsWith('.md')
          ? split.root + resolved
          : resolved,
      relative: beforeHash,
    }
  }
  return { link, relative: false }
}

function resolveLinks(
  content: string,
  tokens: Token[],
  links: Set<string>,
  linksData: Map<
    string,
    {
      version?: 'latest' | 'fixed'
      line: number
      offset: number
      length: number
      file: string
    }[]
  >,
  splits: Split[],
) {
  const originIndices = JSON.parse(
    content.match(/<!-- markee:origin-indices:(.*)? -->/)?.[1] ?? '[]',
  ) as { start: number; directory: string; file: string }[]
  const cleaned = removeDrafts(content, tokens)
  const allLinks = tokens.flatMap((t) => t.links ?? [])
  let offset = 0
  const chunks = splitAroundLinks(cleaned, allLinks).map((chunk, i) => {
    const candidateIndex = originIndices.findLast((o) => o.start <= offset)
    const folder = candidateIndex?.directory as string
    const file = candidateIndex?.file as string
    offset += chunk.length

    if (i % 2) {
      const resolved = resolveLink(chunk, links, folder, splits)
      if (allLinks[(i - 1) / 2] && typeof resolved.relative === 'string') {
        const data = linksData.get(resolved.relative) ?? []
        data.push({
          ...allLinks[(i - 1) / 2].attrs!,
          line: allLinks[(i - 1) / 2].line,
          offset: allLinks[(i - 1) / 2].start,
          length: allLinks[(i - 1) / 2].end - allLinks[(i - 1) / 2].start,
          file,
        })
        linksData.set(resolved.relative, data)
      }
      return resolved.link
    }
    return chunk
  })

  return chunks.join('').replace(/<!-- markee:origin-indices:(.*)? -->/, '')
}

function isVersioned(file: string, folders: Record<string, PagesFile>) {
  return Object.keys(folders).some(
    (f) => folders[f].version && file.startsWith(f),
  )
}

function stringifyAttrs(attrs: Record<string, string | number | boolean>) {
  return Object.entries(attrs)
    .map(([k, v]) => {
      if (k === 'id') return `#${v}`
      if (k === 'class')
        return (
          '.' +
          `${v}`
            .split(' ')
            .map((c) => c.trim())
            .join('.')
        )

      if (typeof v === 'string') {
        if (v === k) {
          return `${k}`
        }
        if (v.includes('')) {
          return `${k}='${v}'`
        }
        return `${k}="${v}"`
      }
      return `${k}=${v}`
    })
    .join(' ')
}

async function preloadFencesAndDirectives(
  content: string,
  tokens: Token[],
  frontMatter: Frontmatter,
  payload: Record<string, Record<string, unknown>>,
) {
  if (!ExtensionsCache.hasBuildTimeExtensions()) return content

  type Change = {
    name: string
    lang?: string
    type?: string
    attrs?: Record<string, string | number | boolean>
    payload?: any
  }

  const pluginConfig = (name: string) => {
    const fromConfig = (config?.plugins as any)?.[name]
    const fromFrontMatter = (frontMatter?.plugins as any)?.[name]
    return fromFrontMatter ?? fromConfig
  }

  const buildFenceLine = (
    params: {
      lang?: string
      attrs: Record<string, string | number | boolean>
    },
    options: {
      markup: string
    },
  ) => {
    if (!params.lang && !Object.keys(params.attrs).length)
      return `${options.markup}`
    if (!params.lang) {
      params.lang = 'none'
    }
    const attrs = stringifyAttrs(params.attrs)
    return `${options.markup}${params.lang} ${attrs}`.trim()
  }
  const buildDirectiveLine = (
    params: {
      type: string
      label: string
      attrs: Record<string, string | number | boolean>
    },
    options: {
      markup: string
    },
  ) => {
    const attrs = stringifyAttrs(params.attrs)
    return `${options.markup}${params.type}${params.label ? `[${params.label}]` : ''}${attrs ? `{${attrs}}` : ''}`
  }

  const fences = tokens
    .filter((t) => t.type === 'fence')
    .map((fence) => ({
      params: {
        content: fence.content,
        lang: fence.lang,
        attrs: { ...fence.attrs },
      },
      options: {
        offset: fence.contentOffset[0],
        line: fence.map[0],
        markup: fence.markup!,
      },
      changes: [] as Change[],
    }))
  const directives = tokens
    .filter(
      (t) =>
        t.type === 'directive_container_open' || t.type === 'directive_leaf',
    )
    .map((directive) => ({
      params: {
        content: directive.content,
        type: directive.meta.name as string,
        label: directive.meta.label as string,
        attrs: { ...directive.attrs },
      },
      options: {
        offset: directive.contentOffset[0],
        line: directive.map[0],
        markup: directive.meta.fence as string,
      },
      changes: [] as Change[],
    }))

  ;[...fences, ...directives].forEach((fence) => {
    if (!fence.params.attrs.id)
      fence.params.attrs.id = payloadSlugger.slug('mk-payload')
  })

  const extensions = ExtensionsCache.getBuildTimeExtensions()
  const nameRegistry = new Map<string, string>()
  for (const ext of extensions) {
    try {
      const { preloadFence, preloadDirective, name } = await import(ext)

      if (!name) continue
      if (!preloadFence && !preloadDirective) continue
      if (nameRegistry.has(name)) {
        console.log('Another extension already registered the name', name)
        console.log('Previously registered by', nameRegistry.get(name))
        console.log('Skipping extension', ext)
        continue
      }
      nameRegistry.set(name, ext)

      if (preloadFence) {
        for (const fence of fences) {
          const ret = await preloadFence(fence.params, pluginConfig(name))
          if (!ret || typeof ret !== 'object') continue
          const { lang, attrs, payload } = ret
          let change: null | Change = null
          if (lang && lang !== fence.params.lang) {
            change ??= { name }
            change.lang = lang
          }
          if (
            attrs &&
            JSON.stringify(attrs) !== JSON.stringify(fence.params.attrs)
          ) {
            change ??= { name }
            change.attrs = attrs
          }
          if (payload) {
            change ??= { name }
            change.payload = payload
          }
          if (change) fence.changes.push(change)
        }
      }

      if (preloadDirective) {
        for (const directive of directives) {
          const ret = await preloadDirective(
            directive.params,
            pluginConfig(name),
          )
          if (!ret || typeof ret !== 'object') continue
          const { type, attrs, payload } = ret
          let change: null | Change = null
          if (type && type !== directive.params.type) {
            change ??= { name }
            change.type = type
          }
          if (
            attrs &&
            JSON.stringify(attrs) !== JSON.stringify(directive.params.attrs)
          ) {
            change ??= { name }
            change.attrs = attrs
          }
          if (payload) {
            change ??= { name }
            change.payload = payload
          }
          if (change) directive.changes.push(change)
        }
      }
    } catch (err) {
      console.error('An error occurred while running extension module', ext)
      console.error(err)
    }
  }

  const lines = content.split('\n')
  fences.forEach((fence) => {
    if (!fence.changes.length) return
    const id = fence.params.attrs.id
    const { lang, attrs } = fence.changes.reduce(
      (acc, change) => {
        if (change.lang) acc.lang = change.lang

        if (change.attrs) {
          acc.attrs = { ...acc.attrs, ...change.attrs, id }
        }

        if (change.payload) {
          payload[id] ??= {}
          payload[id][change.name] = change.payload
        }
        return acc
      },
      { lang: fence.params.lang, attrs: fence.params.attrs },
    )

    lines[fence.options.line] =
      lines[fence.options.line].slice(0, fence.options.offset) +
      buildFenceLine({ lang, attrs }, fence.options)
  })

  directives.forEach((directive) => {
    if (!directive.changes.length) return
    const id = directive.params.attrs.id
    const { type, attrs } = directive.changes.reduce(
      (acc, change) => {
        if (change.type) acc.type = change.type

        if (change.attrs) {
          acc.attrs = { ...acc.attrs, ...change.attrs, id }
        }

        if (change.payload) {
          payload[id] ??= {}
          payload[id][change.name] = change.payload
        }
        return acc
      },
      { type: directive.params.type, attrs: directive.params.attrs },
    )

    lines[directive.options.line] =
      lines[directive.options.line].slice(0, directive.options.offset) +
      buildDirectiveLine(
        { type, attrs, label: directive.params.label },
        directive.options,
      )
  })

  return lines.join('\n')
}

/* Search index */
const slugger = new GithubSlugger()
const payloadSlugger = new GithubSlugger()
payloadSlugger.slug('mk-payload')

export const MarkdownCompute = {
  initialFileData: (
    file: string,
    source: (typeof config)['sources'][number],
  ) => {
    const root = ConfigCache.getRoot(source.root)
    const filePath = PathHelpers.concat('/', root, file)
    return {
      path: filePath,
      data: {
        link: getFileLink(file, root, source.mount),
        layout: source.layout ?? inferDefaultLayout(source),
        frontMatter: { excerpt: '' },
        readingTime: 0,
        payload: {},
      },
    }
  },
  inclusions: async (file: string, content: string, visited: string[] = []) => {
    return resolveMarkdownInclusions(file, content, visited)
  },
  tokens: async (content: string) => {
    const tokens = SimpleTokenizer.tokenizeMarkdown(content)
    const drafts = tokens.filter(
      (t) => t.type === 'directive_container_open' && t.meta.name === 'draft',
    )
    return tokens.filter(
      (t) =>
        mode === 'preview' ||
        t.type !== 'inline' ||
        !drafts.some((d) => t.map[0] >= d.map[0] && t.map[1] <= d.map[1]),
    )
  },
  sanitizedContent: async (
    content: string,
    tokens: Token[],
    {
      splits,
      links,
      linksData,
      payload,
      frontMatter,
    }: {
      splits: Split[]
      links: Set<string>
      linksData: Map<
        string,
        {
          version?: 'latest' | 'fixed'
          line: number
          offset: number
          length: number
          file: string
        }[]
      >
      payload: Record<string, Record<string, unknown>>
      frontMatter: Frontmatter
    },
  ) => {
    const sanitized = resolveLinks(content, tokens, links, linksData, splits)
    return preloadFencesAndDirectives(sanitized, tokens, frontMatter, payload)
  },
  frontMatter: async (
    tokens: Token[],
    { file, folder, splits }: { file: string; folder: string; splits: Split[] },
  ) => {
    const frontMatterToken = tokens.find((t) => t.type === 'front_matter')
    const frontMatter = parseFrontMatter(
      frontMatterToken?.meta ?? '',
      file,
    ) as Frontmatter

    sanitizeFrontMatterValues(frontMatter)

    const h1s = tokens.filter((t) => t.title && t.tag === 'h1')
    const h2s = tokens.filter((t) => t.title && t.tag === 'h2')

    if (!frontMatter.title && h1s.length === 1) {
      frontMatter.title = h1s[0].title
    }
    if (!frontMatter.title && h2s.length === 1) {
      frontMatter.title = h2s[0].title
    }

    if (!frontMatter.excerpt) {
      frontMatter.excerpt = frontMatter.description!
    }
    if (!frontMatter.excerpt) {
      frontMatter.excerpt = tokens
        .filter(
          (token) =>
            !token.title &&
            token.text &&
            !token.raw.match(/<!-- markee:origin-indices:(.*) -->/),
        )
        .map((token) => token.text)
        .join('\n')

      if (frontMatter.excerpt.length > 200) {
        frontMatter.excerpt =
          frontMatter.excerpt
            .split(' ')
            .reduce(
              (acc, word) => (acc.length > 200 ? acc : acc + ' ' + word),
              '',
            )
            .trim() + '...'
      }
    }

    if (frontMatter.image) {
      frontMatter.image = resolveLink(
        frontMatter.image as string,
        new Set<string>(),
        folder,
        splits,
      ).link
    }

    return frontMatter
  },
  searchIndex: (tokens: Token[], { title }: { title: string }) => {
    slugger.reset()

    const headers: {
      label: string
      anchor: string
      contents: string[]
      level: string
    }[] =
      title && !tokens.some((t) => t.title && t.tag === 'h1')
        ? [
            {
              label: title,
              level: 'h1',
              anchor: `#${slugger.slug(title)}`,
              contents: [],
            },
          ]
        : []

    tokens.forEach((token) => {
      if (token.title) {
        headers.push({
          label: token.title,
          level: token.tag as string,
          anchor: `#${token.attrs?.id || slugger.slug(token.title)}`,
          contents: [],
        })
        return
      }

      if (token.raw.match(/<!-- markee:origin-indices:(.*) -->/)) {
        return
      }

      if (token.type === 'inline') {
        headers.at(-1)?.contents.push(token.raw)
      }
      if (token.type === 'fence') {
        headers.at(-1)!.contents[headers.at(-1)!.contents.length - 1] +=
          '\n' + token.raw
      }
    })

    return Object.fromEntries(
      headers
        .filter((h) => h.contents.length > 0)
        .map((h) => [h.anchor, { l: h.label, lv: h.level, c: h.contents }]),
    )
  },
  brokenLinks: async ({
    source,
    linksData,
    folders,
  }: {
    source: string
    links: Set<string>
    linksData: Map<
      string,
      {
        version?: 'latest' | 'fixed'
        line: number
        offset: number
        length: number
        file: string
      }[]
    >
    frontMatter: Frontmatter
    folders: Record<string, PagesFile>
  }) => {
    const lines = source.split('\n')
    const candidates = [...linksData.entries()].flatMap(([link, data]) =>
      data.map((d) => ({
        link,
        offset: d.offset,
        length: d.length,
        line: lines[d.line],
        file: d.file,
        version: d.version,
      })),
    )

    return (
      await Promise.all(
        candidates.map(async (link) => {
          const file = PathHelpers.concat(ROOT_DIR, link.link)
          if (!(await fs.exists(file))) {
            if (link.link.startsWith('/_assets/_extension/')) {
              const extensionFile = link.link.slice(
                '/_assets/_extension/'.length,
              )
              return (await fs.pathExists(
                new URL(import.meta.resolve(extensionFile)).pathname,
              ))
                ? []
                : [link]
            }
            if (link.link.startsWith('/_assets/')) {
              return (await ExtensionsCache.getExtensionFile(link.link))
                ? []
                : [link]
            }

            return [link]
          }
          if (isVersioned(link.link, folders) && !link.version)
            return [{ ...link, unqualified: true }]
          return []
        }),
      )
    ).flat()
  },
  readingTime: async (content: string) => {
    return (readingTime(content).words * 5) / 1000
  },
  reportBrokenLinks: async (
    key: string,
    links: {
      link: string
      offset: number
      length: number
      line: string
      file: string
      unqualified?: boolean
    }[],
  ) => {
    if (links.length === 0) return 0

    const rawLines = MarkdownCache.get(key).raw.split('\n')

    const fileLine = async (file: string, line: string, offset: number) => {
      const candidateLines =
        file === key
          ? rawLines
          : (await MarkdownCache.get(file).readFromDisk()).split('\n')

      const lineIndex = candidateLines.indexOf(line)
      if (lineIndex >= 0) {
        return color.blue(
          PathHelpers.concat(ROOT_DIR, file) +
            ':' +
            (lineIndex + 1) +
            ':' +
            (offset + 1) +
            ':' +
            (file !== key ? ' (included)' : ''),
        )
      }
      return color.blue(
        color.italic(
          `Unknown location, most likely an include with rewrite-relative-urls: false`,
        ),
      )
    }

    console.log(
      color.red('Found broken links in file'),
      color.red(color.bold(key)),
    )
    await Promise.all(
      links.map(async (link) => {
        console.info(
          '    ' + (await fileLine(link.file, link.line, link.offset)),
        )
        console.info(color.blue('    Not found: ' + link.link))

        if (link.unqualified) {
          console.info(
            '      ' +
              color.yellow(
                'Links to versioned files need to be tagged with either {version=latest} or {version=fixed}',
              ),
          )
          console.info(
            '      ' +
              color.yellow(
                'Use {version=latest} if you want the build to always resolve to the latest version of the file',
              ),
          )
          console.info(
            '      ' +
              color.yellow(
                'Use {version=fixed} if you want the build to resolve to the specified version',
              ),
          )
        }

        console.info(
          '    ' +
            color.gray(link.line.slice(0, link.offset).trim()) +
            color.underline(
              color.red(
                link.line.slice(link.offset, link.offset + link.length),
              ),
            ) +
            color.gray(link.line.slice(link.offset + link.length).trim()),
        )
      }),
    )

    return links.length
  },
}
