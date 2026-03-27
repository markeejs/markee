import { readFile, rm, writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { Plugin } from 'vite'

const INLINE_HEAD_JS_LIMIT_KB = 4
const INLINE_HEAD_JS_LIMIT_BYTES = INLINE_HEAD_JS_LIMIT_KB * 1024
const INLINE_HEAD_CSS_LIMIT_KB = 16
const INLINE_HEAD_CSS_LIMIT_BYTES = INLINE_HEAD_CSS_LIMIT_KB * 1024
const INLINE_HEAD_IMPORT_RE = /\bimport\b/

type BundleAsset = {
  type: 'asset'
  fileName: string
  source: string | Uint8Array
}

type BundleChunk = {
  type: 'chunk'
  fileName: string
  code: string
}

type BundleEntry = BundleAsset | BundleChunk
type BundleLike = Record<
  string,
  BundleEntry | { type: string; source?: unknown }
>

function isBundleEntry(entry: unknown): entry is BundleEntry {
  if (!entry || typeof entry !== 'object') return false

  if ((entry as { type?: unknown }).type === 'chunk') {
    return (
      typeof (entry as { fileName?: unknown }).fileName === 'string' &&
      typeof (entry as { code?: unknown }).code === 'string'
    )
  }

  if ((entry as { type?: unknown }).type === 'asset') {
    return (
      typeof (entry as { fileName?: unknown }).fileName === 'string' &&
      (typeof (entry as { source?: unknown }).source === 'string' ||
        ArrayBuffer.isView((entry as { source?: unknown }).source))
    )
  }

  return false
}

function getBundleEntry(bundle: BundleLike, url: string): BundleEntry | null {
  if (!url.startsWith('/')) return null
  const entry = bundle[url.slice(1)]
  return isBundleEntry(entry) ? entry : null
}

function getEntrySize(entry: BundleEntry) {
  if (entry.type === 'asset') {
    const source =
      typeof entry.source === 'string'
        ? entry.source
        : Buffer.from(entry.source).toString('utf8')
    return Buffer.byteLength(source)
  }

  return Buffer.byteLength(entry.code)
}

function getAssetSource(entry: BundleAsset) {
  return typeof entry.source === 'string'
    ? entry.source
    : Buffer.from(entry.source).toString('utf8')
}

export function inlineHeadAssets(html: string, bundle: BundleLike) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)
  if (!head) return { html, inlinedFiles: [] as string[] }

  const inlinedFiles: string[] = []
  let nextHead = head[1]

  nextHead = nextHead.replace(/<script\b[^>]*><\/script>/g, (tag) => {
    const type = tag.match(/\btype=(["'])module\1/)
    const src = tag.match(/\bsrc=(["'])([^"']+)\1/)
    if (!type || !src) return tag

    const entry = getBundleEntry(bundle, src[2])
    if (!entry || entry.type !== 'chunk') return tag
    if (getEntrySize(entry) > INLINE_HEAD_JS_LIMIT_BYTES) return tag
    if (INLINE_HEAD_IMPORT_RE.test(entry.code)) return tag

    inlinedFiles.push(entry.fileName)
    return `<script type="module">${entry.code}</script>`
  })

  nextHead = nextHead.replace(/<link\b[^>]*>/g, (tag) => {
    const rel = tag.match(/\brel=(["'])stylesheet\1/)
    const href = tag.match(/\bhref=(["'])([^"']+)\1/)
    if (!rel || !href) return tag

    const entry = getBundleEntry(bundle, href[2])
    if (!entry || entry.type !== 'asset') return tag
    if (getEntrySize(entry) > INLINE_HEAD_CSS_LIMIT_BYTES) return tag
    const source = getAssetSource(entry)
    if (INLINE_HEAD_IMPORT_RE.test(source)) return tag

    inlinedFiles.push(entry.fileName)
    return `<style>${source}</style>`
  })

  return {
    html: html.replace(head[1], nextHead),
    inlinedFiles,
  }
}

export function pluginInlineHeadAssets() {
  return {
    name: 'markee-inline-head-assets',
    apply: 'build',
    async writeBundle(options, bundle) {
      const outDir = resolvePath(process.cwd(), options.dir ?? 'dist')
      const indexFile = resolvePath(outDir, 'index.html')
      const html = await readFile(indexFile, 'utf8').catch(() => null)
      if (!html) return

      const { html: nextHtml, inlinedFiles } = inlineHeadAssets(
        html,
        bundle as BundleLike,
      )
      if (nextHtml === html) return

      await writeFile(indexFile, nextHtml, 'utf8')
      await Promise.all(
        inlinedFiles.map((fileName) =>
          rm(resolvePath(outDir, fileName), { force: true }),
        ),
      )
    },
  } satisfies Plugin
}
