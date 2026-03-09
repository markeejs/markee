import { parse as parseYaml } from 'yaml'

export function encodeText(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

export function decodeText(encoded: string) {
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function toErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown error'
}

export function getStringFromMeta(meta: Record<string, any>, key: string) {
  const rawValue = meta[key]
  if (rawValue === undefined) return ''
  if (typeof rawValue === 'string') return rawValue.trim()
  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return String(rawValue)
  }
  return ''
}

export function getClassList(meta: Record<string, any>) {
  const classAttr = getStringFromMeta(meta, 'class')
  if (!classAttr) return []
  return classAttr.split(/\s+/).filter(Boolean)
}

export function decodeRecord(encoded?: string) {
  if (!encoded) return {}

  try {
    const parsed = JSON.parse(decodeText(encoded))
    if (parsed && typeof parsed === 'object') return parsed
  } catch {}

  return {}
}

export function sanitizeFilterValue(value: string) {
  const trimmed = value.trim()
  return trimmed.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
}

export function parseOpenApiSource(source: string): Record<string, any> {
  const trimmed = source.trimStart()
  const parsed =
    trimmed.startsWith('{') || trimmed.startsWith('[')
      ? JSON.parse(source)
      : parseYaml(source)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenAPI source must parse to an object.')
  }

  return parsed as Record<string, any>
}
