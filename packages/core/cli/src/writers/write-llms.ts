import fs from 'fs-extra'
import type { MarkdownFile } from '@markee/types'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'
import { PathHelpers } from '../helpers/path.js'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function writeLlms(files: Record<string, MarkdownFile>) {
  await fs.writeFile(
    PathHelpers.concat(
      ROOT_DIR,
      ConfigCache.config.build.outDir,
      '_markee',
      'llms.txt',
    ),
    `# Reading this Markee documentation site

The documentation index is available at /_markee/navigation.json.

The index's "files" property is a map. Each key is the URL of a served Markdown file,
absolute from the root of the site (for example, /docs/getting-started.md).
Read these Markdown files to access the documentation content.

Each entry contains a "link" property with the canonical URL of the corresponding
client-rendered page. Use this URL when citing a source, rather than the Markdown
file URL. Resolve root-relative URLs against this site's origin.

When reading Markdown files, links to other documentation pages are also absolute
URLs from the root of the site. Follow these links to read related documentation.
`,
    'utf8',
  )
  const entries = Object.entries(files)
    .filter(([, file]) => !file.frontMatter.hidden && !file.frontMatter.draft)
    .map(
      ([source, file]) => `  <li>
    <h2>${escapeHtml(file.frontMatter.title ?? source)}</h2>
    <p>Canonical URL for citations: <a href="${escapeHtml(file.link)}">${escapeHtml(file.link)}</a></p>
    <p>${escapeHtml(file.frontMatter.description ?? file.frontMatter.excerpt)}</p>
    <p><a href="${escapeHtml(source)}">Read Markdown source: ${escapeHtml(source)}</a></p>
  </li>`,
    )

  await fs.writeFile(
    PathHelpers.concat(
      ROOT_DIR,
      ConfigCache.config.build.outDir,
      '_markee',
      'llms.html',
    ),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Documentation index for AI agents</title>
</head>
<body>
  <h1>Documentation index for AI agents</h1>
  <p>This page lists the Markdown files in this website's documentation index, excluding hidden files and drafts, with their titles, descriptions, canonical human-facing URLs, and links to their Markdown sources. Follow the Markdown source links to read the documentation, then follow links within those files to explore related pages. Source URLs and links to other documentation pages are absolute from the site root; resolve them against this site's origin. Use the canonical human-facing URL when citing a page. The full navigation data is available as JSON at <a href="/_markee/navigation.json">/_markee/navigation.json</a>.</p>
  <ul>
${entries.join('\n')}
  </ul>
</body>
</html>
`,
    'utf8',
  )
}
