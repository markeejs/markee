import fs from 'fs-extra'
import { globby } from 'globby'

import { CLIENT_FILE, ROOT_DIR } from '../constants.js'

import { PathHelpers } from '../helpers/path.js'

import { BustCache } from './bust-cache.js'
import { ExtensionsCache } from './extensions-cache.js'

export class HtmlCache {
  /**
   * Generate the content to inject in the <head> part of the HTML file
   * to load all JS, CSS and HTML assets in _head
   * @param root - root folder to search _head in
   * @param extensionName - name of the extension we are reading from, if relevant
   */
  private static async headContent(root: string, extensionName?: string) {
    // Find the main _head.html HTML fragment file
    const headFile = await fs
      .readFile(PathHelpers.concat(root, '_assets/_head.html'), 'utf-8')
      .catch(() => '')
    // Check when the main head file was last modified
    const modifiedHead = headFile
      ? (await fs.stat(PathHelpers.concat(root, '_assets/_head.html'))).mtimeMs
      : 0

    // Find all JS, CSS and HTML assets in the _head directory
    const files = await globby(
      ['**/*.js', '**/*.mjs', '**/*.css', '**/*.html'],
      {
        cwd: PathHelpers.concat(root, '_assets/_head'),
      },
    )

    // Compute the base URL for our assets based on whether we are in an extension or
    // not; this is used to inject the correct URL in the <script> and <link> tags we generate
    const baseUrl = extensionName
      ? '/_assets/_extension/' + extensionName + '/_assets/_head'
      : '/_assets/_head'

    // Resolve all files based on their extension and last modification time,
    // and build an array of keyed HTML fragments.
    // In build mode we will use those fragments to build the output HTML file directly;
    // In dev mode, the fragments are sent to the client which can lazy-load and hot-reload
    const headFiles = (
      await Promise.all(
        files.map(async (file) => {
          const modified = new Date(
            (await fs.stat(PathHelpers.concat(root, '_assets/_head', file)))
              .mtimeMs,
          ).valueOf()

          // JS and MJS files are loaded as JS modules
          if (file.endsWith('.js') || file.endsWith('.mjs')) {
            if (PathHelpers.basename(file).startsWith('_')) {
              return
            }

            return {
              key: baseUrl + '/' + file,
              modified: await BustCache.getFileTime(
                PathHelpers.concat(root, '_assets/_head', file),
              ),
              kind: 'script' as const,
              html: `<script type="module" src="${baseUrl}/${file}"></script>`,
            }
          }

          // CSS files are loaded as CSS stylesheets
          if (file.endsWith('.css')) {
            return {
              key: baseUrl + '/' + file,
              modified: await BustCache.getFileTime(
                PathHelpers.concat(root, '_assets/_head', file),
              ),
              kind: 'style' as const,
              html: `<link rel="stylesheet" href="${baseUrl}/${file}" />`,
            }
          }

          // The rest is loaded as an HTML fragment to be inserted as is
          return {
            key: baseUrl + '/' + file,
            modified,
            kind: 'fragment' as const,
            html: await fs
              .readFile(
                PathHelpers.concat(root, '_assets', '_head', file),
                'utf-8',
              )
              .catch(
                () =>
                  '<!-- Error loading file ' +
                  PathHelpers.concat(root, '_assets', '_head', file) +
                  ' -->',
              ),
          }
        }),
      )
    ).filter((file) => !!file)

    // If there was a main `_head.html` file, insert is as a very first HTML fragment
    if (headFile) {
      headFiles.unshift({
        kind: 'fragment' as const,
        modified: modifiedHead,
        html: headFile,
        key: baseUrl + '.html',
      })
    }

    return headFiles
  }

  static async head() {
    const extensions = await Promise.all(
      Object.entries(ExtensionsCache.loadExtensions())
        .map(([extension, extensionPath]) => [
          extension,
          PathHelpers.dirname(extensionPath),
        ])
        .map(
          async ([extension, extensionRoot]) =>
            await this.headContent(extensionRoot, extension),
        ),
    )

    const main = await this.headContent(ROOT_DIR)

    return [...extensions, main].flat()
  }

  static async index(injectHeadContent: boolean) {
    let index = await fs.readFile(CLIENT_FILE, 'utf-8')

    if (injectHeadContent) {
      const head = await HtmlCache.head()

      index = index.replace(
        '</head>',
        head.map((item) => item.html).join('\n') + '</head>',
      )
    } else {
      index = index.replace(
        /src="\/assets\/app-.*?.js"/,
        'src="/assets/development.js"',
      )
    }

    return index.replace(
      '<title>Markee</title>',
      `<title>${config.title || 'Markee'}</title>`,
    )
  }
}
