import { defineConfig } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pluginExposeDependency } from './vite/plugin-expose-dependency.js'

const MARKEE_DEV_SERVER = 'http://localhost:8000'

function toViteFsUrl(absPath: string): string {
  return `/@fs${encodeURI(fileURLToPath(absPath))}`
}

export default defineConfig({
  plugins: [
    {
      name: 'markee-development-mode',
      apply: 'serve',
      transformIndexHtml: async (html) => {
        return html
          .replace(
            '</head>',
            `<script>window[Symbol.for('markee::development')] = true</script></head>`,
          )
          .replace(/src="\/src\/main.ts(\?.*)?"/, 'src="/src/development.ts$1"')
      },
    },
    {
      name: 'markee-sourcemap-exclusion',
      transform(code: string, id: string) {
        if (id.includes('node_modules')) {
          return {
            code,
            map: { mappings: '' },
          }
        }
      },
    },
    {
      name: 'markee-importmap',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          let importMap: { imports: Record<string, string> } = {
            imports: {
              'lit': '/assets/lit/index.js',
              'lit/': '/assets/lit/',
              'nanostores': '/assets/nanostores/index.js',
              '@nanostores/lit': '/assets/@nanostores/lit/index.js',
              '@nanostores/persistent':
                '/assets/@nanostores/persistent/index.js',
              '@markee/state': '/assets/@markee/state/index.js',
              '@markee/runtime': '/assets/@markee/runtime/index.js',
              '@markee/elements': '/assets/@markee/elements/index.js',
              '@markee/pipeline': '/assets/@markee/pipeline/index.js',
              '@markee/search': '/assets/@markee/search/index.js',
            },
          }

          if (ctx.server) {
            importMap = {
              imports: {
                'lit': toViteFsUrl(import.meta.resolve('lit')),
                'lit/': dirname(toViteFsUrl(import.meta.resolve('lit'))) + '/',
                'nanostores': toViteFsUrl(import.meta.resolve('nanostores')),
                '@nanostores/lit': toViteFsUrl(
                  import.meta.resolve('@nanostores/lit'),
                ),
                '@nanostores/persistent': toViteFsUrl(
                  import.meta.resolve('@nanostores/persistent'),
                ),
                '@markee/state': toViteFsUrl(
                  import.meta.resolve('@markee/state/index.ts'),
                ),
                '@markee/runtime': toViteFsUrl(
                  import.meta.resolve('@markee/runtime/index.ts'),
                ),
                '@markee/pipeline': toViteFsUrl(
                  import.meta.resolve('@markee/pipeline/index.ts'),
                ),
                '@markee/elements': toViteFsUrl(
                  import.meta.resolve('@markee/elements/index.ts'),
                ),
                '@markee/search': toViteFsUrl(
                  import.meta.resolve('@markee/search/index.ts'),
                ),
              },
            }
          }

          return {
            html,
            tags: [
              {
                tag: 'script',
                attrs: { type: 'importmap' },
                children: JSON.stringify(importMap, null, 2),
                injectTo: 'head-prepend',
              },
            ],
          }
        },
      },
    },
    pluginExposeDependency('lit'),
    pluginExposeDependency('nanostores'),
    pluginExposeDependency('@nanostores/lit'),
    pluginExposeDependency('@nanostores/persistent'),
    pluginExposeDependency('@markee/state'),
    pluginExposeDependency('@markee/runtime'),
    pluginExposeDependency('@markee/elements'),
    pluginExposeDependency('@markee/pipeline'),
    pluginExposeDependency('@markee/search'),
  ],
  optimizeDeps: {
    exclude: ['lit'],
  },
  define: {
    'process.env': JSON.stringify({}),
  },
  server: {
    proxy: {
      '/_markee/see': {
        target: MARKEE_DEV_SERVER,
        configure: (proxy) => {
          proxy.on('proxyReq', (req, _, res) => {
            res.on('close', () => req.destroy())
          })
        },
      },
      '/_markee': MARKEE_DEV_SERVER,
      '^/(?!src|node_modules|@vite|@fs|assets).+\\..+': {
        target: MARKEE_DEV_SERVER,
        bypass: (req) => {
          if (req.headers['sec-fetch-mode'] === 'navigate') return req.url
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: /^@markee\/runtime$/, replacement: '@markee/runtime/index.ts' },
      { find: /^@markee\/state$/, replacement: '@markee/state/index.ts' },
      { find: /^@markee\/pipeline$/, replacement: '@markee/pipeline/index.ts' },
      { find: /^@markee\/search$/, replacement: '@markee/search/index.ts' },
      { find: /^@markee\/elements$/, replacement: '@markee/elements/index.ts' },
      {
        find: /^@markee\/runtime\/index\.js$/,
        replacement: '@markee/runtime/index.ts',
      },
      {
        find: /^@markee\/state\/index\.js$/,
        replacement: '@markee/state/index.ts',
      },
      {
        find: /^@markee\/pipeline\/index\.js$/,
        replacement: '@markee/pipeline/index.ts',
      },
      {
        find: /^@markee\/search\/index\.js$/,
        replacement: '@markee/search/index.ts',
      },
      {
        find: /^@markee\/elements\/index\.js$/,
        replacement: '@markee/elements/index.ts',
      },
    ],
  },
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: {
        app: resolve(__dirname, 'index.html'),
        development: resolve(__dirname, 'src/development.ts'),
      },
      output: {
        entryFileNames(chunk) {
          if (chunk.name === 'development') return 'assets/development.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames(chunk) {
          return (
            pluginExposeDependency.chunk('lit', chunk.name) ||
            pluginExposeDependency.chunk('nanostores', chunk.name) ||
            pluginExposeDependency.chunk('@nanostores/lit', chunk.name) ||
            pluginExposeDependency.chunk(
              '@nanostores/persistent',
              chunk.name,
            ) ||
            pluginExposeDependency.chunk('@markee/state', chunk.name) ||
            pluginExposeDependency.chunk('@markee/runtime', chunk.name) ||
            pluginExposeDependency.chunk('@markee/elements', chunk.name) ||
            pluginExposeDependency.chunk('@markee/pipeline', chunk.name) ||
            pluginExposeDependency.chunk('@markee/search', chunk.name) ||
            'assets/[name]-[hash].js'
          )
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
