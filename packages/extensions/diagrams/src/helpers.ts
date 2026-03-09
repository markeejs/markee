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
