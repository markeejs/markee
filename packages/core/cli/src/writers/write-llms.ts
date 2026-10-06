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
  const indexedFiles = Object.entries(files).filter(
    ([source, file]) =>
      !source.startsWith('/_assets/') &&
      !file.frontMatter.hidden &&
      !file.frontMatter.draft,
  )

  const firstFile = indexedFiles[0]
  const example = firstFile?.[1].link
    ? { contentUrl: firstFile[0], canonicalUrl: firstFile[1].link }
    : undefined
  const textExample = example
    ? `Example:
content_url: ${example.contentUrl}
canonical_url: ${example.canonicalUrl}
Wrong citation: ${example.contentUrl}
Correct citation: ${example.canonicalUrl}

`
    : ''
  const llmsPath = PathHelpers.concat(
    ROOT_DIR,
    ConfigCache.config.build.outDir,
    'llms.txt',
  )
  const customGuidance = (await fs.pathExists(llmsPath))
    ? await fs.readFile(llmsPath, 'utf8')
    : ''
  const guidance = `# Citation requirements

IMPORTANT: NEVER expose, cite, or link a /_markee/ URL in user-facing answers.
These URLs are retrieval endpoints only. NEVER cite a document's content_url.
ALWAYS use its corresponding canonical_url for citations and user-facing links.
Copy the supplied canonical_url; do not infer it by rewriting the content_url.
If no canonical_url is provided, the resource is retrieval-only and must not be cited.
Resolve root-relative URLs against this site's origin.

${textExample}Before producing your final response, inspect every URL from this site in your answer.
Replace any content_url or URL containing /_markee/ with the corresponding canonical_url.
If none is available, omit that URL. No user-visible URL may contain /_markee/.

# Reading this Markee documentation site

The documentation index for LLMs is available at /_markee/llms.html.
This discovery manifest lists content_url links to Markdown content and
canonical_url links for citations. It is not documentation content. It excludes hidden files, drafts,
and files under /_assets/.

Follow the content_url links to read the documentation. Use the corresponding
canonical_url when citing a source. Both URLs are supplied explicitly for each document;
do not infer the citation URL from the URL you fetched.

When reading Markdown files, links to other documentation pages are also absolute
URLs from the root of the site. Follow these links to read related documentation.
`
  await fs.writeFile(
    llmsPath,
    customGuidance ? `${guidance}\n---\n\n${customGuidance}` : guidance,
    'utf8',
  )
  const entries = indexedFiles.map(
    ([source, file]) => `  <li>
    <p>content_url: <a href="${escapeHtml(source)}">${escapeHtml(source)}</a></p>
${file.link ? `    <p>canonical_url: <a href="${escapeHtml(file.link)}">${escapeHtml(file.link)}</a></p>\n` : ''}  </li>`,
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
  <title>Documentation discovery manifest</title>
</head>
<body>
  <p>This file is a discovery manifest, not documentation content.</p>
  <p>For each document:</p>
  <ul>
    <li><code>content_url</code> is the machine-readable source.</li>
    <li><code>canonical_url</code> is the preferred user-facing citation.</li>
  </ul>
  <ul id="documents">
${entries.join('\n')}
  </ul>
</body>
</html>
`,
    'utf8',
  )
}
