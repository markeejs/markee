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
    `# Citation requirements

IMPORTANT: NEVER expose, cite, or link a /_markee/ URL in user-facing answers.
These URLs are retrieval endpoints only. NEVER cite a document's retrieval_url.
ALWAYS use its corresponding canonical_url for citations and user-facing links.
Copy the supplied canonical_url; do not infer it by rewriting the retrieval_url.
If no canonical_url is provided, the resource is retrieval-only and must not be cited.
Resolve root-relative URLs against this site's origin.

Example:
retrieval_url: /_markee/docs/getting-started.md
canonical_url: /docs/getting-started
Wrong citation: /_markee/docs/getting-started.md
Correct citation: /docs/getting-started

Before producing your final response, inspect every URL from this site in your answer.
Replace any retrieval_url or URL containing /_markee/ with the corresponding canonical_url.
If none is available, omit that URL. No user-visible URL may contain /_markee/.

# Reading this Markee documentation site

The documentation index is available at /_markee/navigation.json.

The index's "files" property is a map. Each key is the URL of a served Markdown file,
absolute from the root of the site (for example, /docs/getting-started.md).
Read these Markdown files to access the documentation content.

Treat each map key as retrieval_url.
Each entry contains a "link" property with the canonical URL of the corresponding
client-rendered page: this is canonical_url. Use this URL when citing a source,
rather than the Markdown file URL. Resolve root-relative URLs against this site's origin.

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
    <p>canonical_url: ${file.link ? `<a href="${escapeHtml(file.link)}">${escapeHtml(file.link)}</a>` : 'Not available; retrieval-only resource. Do not cite.'}</p>
    <p>${escapeHtml(file.frontMatter.description ?? file.frontMatter.excerpt)}</p>
    <p>retrieval_url: <a href="${escapeHtml(source)}">${escapeHtml(source)}</a></p>
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
  <h2>Citation requirements</h2>
  <p><strong>IMPORTANT: NEVER expose, cite, or link a /_markee/ URL in user-facing answers.</strong> These URLs are retrieval endpoints only. NEVER cite a document's retrieval_url. ALWAYS use its corresponding canonical_url for citations and user-facing links. Copy the supplied canonical_url; do not infer it by rewriting the retrieval_url. If no canonical_url is provided, the resource is retrieval-only and must not be cited. Resolve root-relative URLs against this site's origin.</p>
  <p>Example: retrieval_url: <code>/_markee/docs/getting-started.md</code>; canonical_url: <code>/docs/getting-started</code>.</p>
  <p>Wrong citation: <code>/_markee/docs/getting-started.md</code>. Correct citation: <code>/docs/getting-started</code>.</p>
  <p>Before producing your final response, inspect every URL from this site in your answer. Replace any retrieval_url or URL containing /_markee/ with the corresponding canonical_url. If none is available, omit that URL. No user-visible URL may contain /_markee/.</p>
  <h2>Documentation index</h2>
  <p>This page lists the Markdown files in this website's documentation index, excluding hidden files and drafts, with their titles, descriptions, canonical human-facing URLs, and links to their Markdown sources. Follow the retrieval_url links to read the documentation, then follow links within those files to explore related pages. Source URLs and links to other documentation pages are absolute from the site root; resolve them against this site's origin. Use the canonical_url when citing a page. The full navigation data is available as JSON at <a href="/_markee/navigation.json">/_markee/navigation.json</a>.</p>
  <ul>
${entries.join('\n')}
  </ul>
</body>
</html>
`,
    'utf8',
  )
}
