import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function setMtime(filePath: string, time: number) {
  const date = new Date(time)
  await fs.utimes(filePath, date, date)
}

describe('BustCache', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('rewrites relative JS imports with the effective descendant mtime and clears cached parses', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'markee-cli-bust-js-'))
    const entry = path.join(root, 'entry.js')
    const child = path.join(root, 'child.js')
    const leaf = path.join(root, 'leaf.js')

    await fs.writeFile(
      entry,
      [
        "import './child.js'",
        "import './leaf.js?stable'",
        "import './leaf.js?x=1'",
        "import 'colors/safe.js'",
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(child, "import './leaf.js'\n", 'utf8')
    await fs.writeFile(leaf, 'export const leaf = true\n', 'utf8')

    await setMtime(entry, 1000)
    await setMtime(child, 2000)
    await setMtime(leaf, 3000)

    const { BustCache } = await import('./bust-cache.js')

    await expect(BustCache.getFileTime(entry)).resolves.toBe(3000)

    const first = await BustCache.treatFile(entry)
    expect(first).toContain('./child.js?t=3000')
    expect(first).toContain('./leaf.js?stable')
    expect(first).toContain('./leaf.js?x=1&t=3000')
    expect(first).toContain("import 'colors/safe.js'")

    await fs.writeFile(entry, "import './child.js?x=2'\n", 'utf8')
    BustCache.clearFile(entry)
    BustCache.clearAll()

    const second = await BustCache.treatFile(entry)
    expect(second).toContain('./child.js?x=2&t=3000')
  })

  it('handles cyclic JS imports and rewrites CSS imports', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-bust-css-'),
    )
    const a = path.join(root, 'a.js')
    const b = path.join(root, 'b.js')
    const css = path.join(root, 'style.css')
    const nested = path.join(root, 'nested.css')

    await fs.writeFile(a, "import './b.js'\n", 'utf8')
    await fs.writeFile(b, "import './a.js'\n", 'utf8')
    await fs.writeFile(
      css,
      [
        "/* @import './ignored.css'; */",
        "@import './nested.css';",
        "@import url('./nested.css?theme=dark');",
        '@import url(./nested.css#frag);',
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(nested, 'body { color: red; }\n', 'utf8')

    await setMtime(a, 4000)
    await setMtime(b, 5000)
    await setMtime(css, 6000)
    await setMtime(nested, 7000)

    const { BustCache } = await import('./bust-cache.js')

    await expect(BustCache.getFileTime(a)).resolves.toBe(5000)

    const rewritten = await BustCache.treatFile(css)
    expect(rewritten).toContain('./nested.css?t=7000')
    expect(rewritten).toContain('./nested.css?theme=dark&t=7000')
    expect(rewritten).toContain('./nested.css#frag?t=7000')
    expect(rewritten).toContain("/* @import './ignored.css'; */")
  })

  it('returns unchanged content when there are no rewritable imports and reuses cached parse results', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-bust-plain-'),
    )
    const plainJs = path.join(root, 'plain.js')
    const stableJs = path.join(root, 'stable.js')
    const leaf = path.join(root, 'leaf.js')
    const plainCss = path.join(root, 'plain.css')

    await fs.writeFile(plainJs, 'export const value = 1\n', 'utf8')
    await fs.writeFile(
      stableJs,
      [
        "import './leaf.js?stable=1'",
        "import 'colors/safe.js'",
        "import.meta.glob('./*.js')",
      ].join('\n'),
      'utf8',
    )
    await fs.writeFile(leaf, 'export const leaf = true\n', 'utf8')
    await fs.writeFile(plainCss, 'body { color: black; }\n', 'utf8')

    await setMtime(plainJs, 8000)
    await setMtime(stableJs, 9000)
    await setMtime(leaf, 10000)
    await setMtime(plainCss, 11000)

    const { BustCache } = await import('./bust-cache.js')

    await expect(BustCache.treatFile(plainJs)).resolves.toBe(
      'export const value = 1\n',
    )
    await expect(BustCache.treatFile(stableJs)).resolves.toBe(
      [
        "import './leaf.js?stable=1'",
        "import 'colors/safe.js'",
        "import.meta.glob('./*.js')",
      ].join('\n'),
    )
    await expect(BustCache.treatFile(plainCss)).resolves.toBe(
      'body { color: black; }\n',
    )

    await expect(BustCache.getFileTime(stableJs)).resolves.toBe(10000)

    BustCache.clearAll()

    await expect(BustCache.getFileTime(stableJs)).resolves.toBe(10000)
  })

  it('handles parent-relative imports, css file mtimes, and malformed unquoted css urls', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-bust-parent-'),
    )
    const nestedDir = path.join(root, 'nested')
    const nestedCssDir = path.join(root, 'css')
    await fs.mkdir(nestedDir)
    await fs.mkdir(nestedCssDir)

    const parentLeaf = path.join(root, 'parent-leaf.js')
    const nestedEntry = path.join(nestedDir, 'entry.js')
    const nestedCss = path.join(nestedCssDir, 'style.css')
    const malformedCss = path.join(nestedCssDir, 'malformed.css')
    const brokenCss = path.join(nestedCssDir, 'broken.css')

    await fs.writeFile(parentLeaf, 'export const parentLeaf = true\n', 'utf8')
    await fs.writeFile(
      nestedEntry,
      "import '../parent-leaf.js?x=1#frag'\n",
      'utf8',
    )
    await fs.writeFile(
      nestedCss,
      '@import url(  ./broken.css  );\nbody{color:blue}\n',
      'utf8',
    )
    await fs.writeFile(
      malformedCss,
      '@import url(  ./broken.css  \nbody{color:blue}\n',
      'utf8',
    )
    await fs.writeFile(brokenCss, 'body { color: red; }\n', 'utf8')

    await setMtime(parentLeaf, 12000)
    await setMtime(nestedEntry, 13000)
    await setMtime(brokenCss, 14000)
    await setMtime(nestedCss, 15000)
    await setMtime(malformedCss, 16000)

    const { BustCache } = await import('./bust-cache.js')

    await expect(BustCache.treatFile(nestedEntry)).resolves.toContain(
      "../parent-leaf.js?x=1%23frag&t=12000",
    )
    await expect(BustCache.treatFile(nestedCss)).resolves.toContain(
      './broken.css?t=14000',
    )
    await expect(BustCache.treatFile(malformedCss)).rejects.toThrow(
      /ENOENT: no such file or directory/,
    )
    await expect(BustCache.getFileTime(nestedCss)).resolves.toBe(15000)
  })

  it('parses escaped quote characters inside quoted css imports', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-bust-escaped-css-'),
    )
    const cssQuoted = path.join(root, 'quoted.css')
    const cssUrlQuoted = path.join(root, 'url-quoted.css')
    const cssUrlSpaced = path.join(root, 'url-spaced.css')
    const ok = path.join(root, 'ok.css')

    await fs.writeFile(
      cssQuoted,
      '@import "./quo\\\\\\"ted.css";\n',
      'utf8',
    )
    await fs.writeFile(
      cssUrlQuoted,
      "@import url('./url\\\\\\'quoted.css');\n",
      'utf8',
    )
    await fs.writeFile(
      cssUrlSpaced,
      '@import url("./ok.css"   );\n',
      'utf8',
    )
    await fs.writeFile(ok, 'body { color: purple; }\n', 'utf8')

    await setMtime(cssQuoted, 17000)
    await setMtime(cssUrlQuoted, 18000)
    await setMtime(cssUrlSpaced, 19000)
    await setMtime(ok, 20000)

    const { BustCache } = await import('./bust-cache.js')

    await expect(BustCache.treatFile(cssQuoted)).rejects.toThrow(
      /ENOENT: no such file or directory/,
    )
    await expect(BustCache.treatFile(cssUrlQuoted)).rejects.toThrow(
      /ENOENT: no such file or directory/,
    )
    await expect(BustCache.treatFile(cssUrlSpaced)).resolves.toContain(
      './ok.css?t=20000',
    )
  })

  it('keeps new relative imports unchanged when only the parse cache is stale and respects encoded stable query params', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'markee-cli-bust-stale-'),
    )
    const staleEntry = path.join(root, 'stale.js')
    const child = path.join(root, 'child.js')
    const encodedStable = path.join(root, 'encoded-stable.js')
    const emptyCss = path.join(root, 'empty.css')

    await fs.writeFile(staleEntry, 'export const stale = true\n', 'utf8')
    await fs.writeFile(child, 'export const child = true\n', 'utf8')
    await fs.writeFile(
      encodedStable,
      "import './child.js?sta%62le=1'\n",
      'utf8',
    )
    await fs.writeFile(emptyCss, '@import url(   );\n', 'utf8')

    await setMtime(staleEntry, 20000)
    await setMtime(child, 21000)
    await setMtime(encodedStable, 22000)
    await setMtime(emptyCss, 23000)

    const { BustCache } = await import('./bust-cache.js')

    await expect(BustCache.treatFile(staleEntry)).resolves.toBe(
      'export const stale = true\n',
    )

    await fs.writeFile(staleEntry, "import './child.js'\n", 'utf8')
    await setMtime(staleEntry, 24000)

    BustCache.clearAll()

    await expect(BustCache.treatFile(staleEntry)).resolves.toBe(
      "import './child.js'\n",
    )
    await expect(BustCache.treatFile(encodedStable)).resolves.toBe(
      "import './child.js?sta%62le=1'\n",
    )
    await expect(BustCache.treatFile(emptyCss)).resolves.toBe(
      '@import url(   );\n',
    )
  })
})
