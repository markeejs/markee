import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { init, parse } from 'es-module-lexer'

await init

type ImportMatch = { start: number; end: number; spec: string }

type ParseCacheEntry = {
  mtimeMs: number
  imports: ImportMatch[]
}

abstract class BaseMtimeCacheBuster {
  public readonly mtimeCacheMs = new Map<string, number>()

  private readonly parseCache = new Map<string, ParseCacheEntry>()
  private readonly inFlight = new Set<string>()

  public clearAll(): void {
    this.mtimeCacheMs.clear()
    this.inFlight.clear()
  }

  public clearFile(filePath: string): void {
    this.parseCache.delete(filePath)
  }

  public async treatFile(filePath: string): Promise<string> {
    await this.computeEffectiveMtimeMs(filePath)
    return this.rewriteFileImportsWithCacheBust(filePath)
  }

  public async getFileTime(filePath: string): Promise<number> {
    return this.computeEffectiveMtimeMs(filePath)
  }

  private async computeEffectiveMtimeMs(entryFile: string): Promise<number> {
    this.inFlight.clear()
    return this.visit(entryFile)
  }

  private async rewriteFileImportsWithCacheBust(
    filePath: string,
  ): Promise<string> {
    const fileAbs = path.resolve(filePath)
    const code = await fs.readFile(fileAbs, 'utf8')

    const imports = this.findImportSpecifiers(code)
    if (imports.length === 0) return code

    const edits: Array<{ start: number; end: number; replacement: string }> = []

    for (const im of imports) {
      if (!this.isRelativeSpecifier(im.spec)) continue

      const importedAbs = this.resolveRelativeImportAbs(fileAbs, im.spec)
      const effectiveMs = importedAbs
        ? this.mtimeCacheMs.get(importedAbs)
        : undefined
      if (effectiveMs === undefined) continue

      const rewrittenSpec = this.withTParam(im.spec, effectiveMs)
      if (rewrittenSpec === im.spec) continue

      edits.push({ start: im.start, end: im.end, replacement: rewrittenSpec })
    }

    if (edits.length === 0) return code

    edits.sort((a, b) => b.start - a.start)

    let out = code
    for (const e of edits)
      out = out.slice(0, e.start) + e.replacement + out.slice(e.end)
    return out
  }

  private async visit(fileAbs: string): Promise<number> {
    const cachedEffective = this.mtimeCacheMs.get(fileAbs)
    if (cachedEffective !== undefined) return cachedEffective

    if (this.inFlight.has(fileAbs)) {
      const { mtimeMs } = await this.getOrParse(fileAbs)
      return mtimeMs
    }
    this.inFlight.add(fileAbs)

    const { mtimeMs: ownMtimeMs, imports } = await this.getOrParse(fileAbs)

    let effective = ownMtimeMs

    for (const im of imports) {
      if (!this.isRelativeSpecifier(im.spec)) continue

      const importedAbs = this.resolveRelativeImportAbs(fileAbs, im.spec)
      if (!importedAbs) continue

      const childEffective = await this.visit(importedAbs)
      if (childEffective > effective) effective = childEffective
    }

    this.mtimeCacheMs.set(fileAbs, effective)
    this.inFlight.delete(fileAbs)
    return effective
  }

  private async getOrParse(fileAbs: string): Promise<ParseCacheEntry> {
    const cached = this.parseCache.get(fileAbs)
    if (cached) return cached

    const st = await fs.stat(fileAbs)
    const mtimeMs = st.mtime.getTime()

    const code = await fs.readFile(fileAbs, 'utf8')
    const imports = this.findImportSpecifiers(code)

    const entry: ParseCacheEntry = { mtimeMs, imports }
    this.parseCache.set(fileAbs, entry)
    return entry
  }

  protected isRelativeSpecifier(spec: string): boolean {
    return spec.startsWith('./') || spec.startsWith('../')
  }

  protected resolveRelativeImportAbs(
    fromFileAbs: string,
    spec: string,
  ): string | null {
    if (!this.isRelativeSpecifier(spec)) return null
    const stripped = this.stripQueryAndHash(spec)
    return path.resolve(path.dirname(fromFileAbs), stripped)
  }

  protected stripQueryAndHash(spec: string): string {
    const q = spec.indexOf('?')
    const h = spec.indexOf('#')
    const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h)
    return cut === -1 ? spec : spec.slice(0, cut)
  }

  protected withTParam(specifier: string, mtimeMs: number): string {
    if (/[?&]stable(?:[=&]|$)/.test(specifier)) return specifier

    const tValue = String(mtimeMs)

    const qIndex = specifier.indexOf('?')
    if (qIndex === -1) return `${specifier}?t=${encodeURIComponent(tValue)}`

    const base = specifier.slice(0, qIndex)
    const query = specifier.slice(qIndex + 1)

    const params = new URLSearchParams(query)
    if (params.has('stable')) return specifier

    params.set('t', tValue)
    const newQuery = params.toString()

    return newQuery ? `${base}?${newQuery}` : base
  }

  protected abstract findImportSpecifiers(code: string): ImportMatch[]
}

class JsImportMtimeCacheBuster extends BaseMtimeCacheBuster {
  protected findImportSpecifiers(code: string): ImportMatch[] {
    const [imports] = parse(code)
    return imports.map((im) => ({
      start: im.s,
      end: im.e,
      spec: code.slice(im.s, im.e),
    }))
  }
}

class CssImportMtimeCacheBuster extends BaseMtimeCacheBuster {
  protected findImportSpecifiers(code: string): ImportMatch[] {
    const out: ImportMatch[] = []
    let i = 0

    while (i < code.length) {
      if (code[i] === '/' && code[i + 1] === '*') {
        i += 2
        while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++
        i += 2
        continue
      }

      if (code[i] === '@' && code.startsWith('@import', i)) {
        i += '@import'.length

        while (i < code.length && isWs(code[i])) i++

        if (code[i] === `"` || code[i] === `'`) {
          const quote = code[i++]
          const specStart = i

          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\' && i + 1 < code.length) i += 2
            else i++
          }

          const specEnd = i
          out.push({
            start: specStart,
            end: specEnd,
            spec: code.slice(specStart, specEnd),
          })

          if (code[i] === quote) i++
          continue
        }

        if (code.startsWith('url(', i)) {
          i += 4
          while (i < code.length && isWs(code[i])) i++

          if (code[i] === `"` || code[i] === `'`) {
            const quote = code[i++]
            const specStart = i

            while (i < code.length && code[i] !== quote) {
              if (code[i] === '\\' && i + 1 < code.length) i += 2
              else i++
            }

            const specEnd = i
            out.push({
              start: specStart,
              end: specEnd,
              spec: code.slice(specStart, specEnd),
            })

            if (code[i] === quote) i++
          } else {
            const rawStart = i
            while (i < code.length && code[i] !== ')') i++
            const rawEnd = i

            const raw = code.slice(rawStart, rawEnd)
            const leadingWs = raw.match(/^\s*/)?.[0].length ?? 0
            const trailingWs = raw.match(/\s*$/)?.[0].length ?? 0

            const specStart = rawStart + leadingWs
            const specEnd = rawEnd - trailingWs

            out.push({
              start: specStart,
              end: specEnd,
              spec: code.slice(specStart, specEnd),
            })
          }

          while (i < code.length && code[i] !== ')') i++
          if (code[i] === ')') i++
          continue
        }
      }

      i++
    }

    return out

    function isWs(ch: string): boolean {
      return (
        ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f'
      )
    }
  }
}

const jsBustCache = new JsImportMtimeCacheBuster()
const cssBustCache = new CssImportMtimeCacheBuster()

export class BustCache {
  static clearAll() {
    jsBustCache.clearAll()
    cssBustCache.clearAll()
  }

  static clearFile(file: string) {
    jsBustCache.clearFile(file)
    cssBustCache.clearFile(file)
  }

  static async treatFile(file: string) {
    if (file.endsWith('.css')) return cssBustCache.treatFile(file)
    return jsBustCache.treatFile(file)
  }

  static async getFileTime(file: string) {
    if (file.endsWith('.css')) return cssBustCache.getFileTime(file)
    return jsBustCache.getFileTime(file)
  }
}
