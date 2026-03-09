export const MAX_VIEW_HEIGHT = '32rem'

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

export function getBooleanFromMeta(
  meta: Record<string, any>,
  key: string,
  defaultValue = false,
) {
  const rawValue = getStringFromMeta(meta, key)
  if (!rawValue) return defaultValue

  switch (rawValue.toLowerCase()) {
    case key.toLowerCase():
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false
    default:
      return defaultValue
  }
}

export function hasClass(meta: Record<string, any>, className: string) {
  const classAttr = meta.class
  if (typeof classAttr !== 'string') return false
  return classAttr.split(/\s+/).includes(className)
}

export function normalizeMaxHeight(raw: string | undefined) {
  if (!raw) return ''
  const value = raw.trim()
  if (!value) return ''

  // Keep accepted values predictable because this is injected as inline style.
  return /^[0-9]+(?:\.[0-9]+)?(?:px|rem|em|vh|vw|%)$/i.test(value) ? value : ''
}

export function countViewDeclarations(source: string) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  const matches = withoutComments.match(/\bview\s+[^\s{]+\s*\{/g)
  return matches?.length ?? 0
}
