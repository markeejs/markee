import fs from 'fs-extra'

import { ROOT_DIR } from '../constants.js'
import { ConfigCache } from '../cache/config-cache.js'
import { PathHelpers } from '../helpers/path.js'

export async function writeLlms() {
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
}
