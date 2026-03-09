import { clientPipeline } from '@markee/pipeline'
import { $navigation } from './store/metadata.js'
import { $configLoader } from './store/metadata.js'

const filesCache = new Map<string, Promise<any>>()

async function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch (e) {
    console.error('Error while parsing JSON data:', value)
    console.error(e)
    return {}
  }
}

async function markdownToHtml(value: string, key: string) {
  const { files } = $navigation.get()
  const file = files[key]
  return clientPipeline(value, file?.frontMatter?.title, key)
}

export async function autoAppend(content: string) {
  const append = $configLoader.get()?.data?.autoAppend ?? []
  const parts = await Promise.all(
    append.map((part) => cache(part, 'markdown-part')),
  )
  return [content, ...parts].join('\n')
}

async function loadFile(
  url: string,
  type: 'markdown' | 'markdown-layout' | 'markdown-part' | 'html' | 'json',
): Promise<unknown> {
  const response = await fetch(url)
  const value = await response.text()

  if (type === 'json') {
    return safeJsonParse(value)
  }

  if (type === 'markdown') {
    return markdownToHtml(await autoAppend(value), url)
  }

  if (type === 'markdown-layout') {
    return markdownToHtml(value, url)
  }

  return value
}

export async function cache(
  url: string,
  type: 'markdown' | 'markdown-part' | 'markdown-layout' | 'html',
): Promise<string | null>
export async function cache<T extends Record<string, any>>(
  url: string,
  type: 'json',
): Promise<T | null>
export async function cache(
  url: string,
  type: 'markdown' | 'markdown-part' | 'markdown-layout' | 'html' | 'json',
): Promise<unknown> {
  const promise =
    filesCache.get(url) ??
    loadFile(url, type).catch((err) => {
      console.error('Error loading file', url)
      console.error(err)
      return null
    })
  filesCache.set(url, promise)
  return promise
}

export function clearCache() {
  filesCache.clear()
}
