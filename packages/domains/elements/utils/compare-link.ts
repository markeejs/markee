export function compareLink(link: string, path: string) {
  if (!link || !path) return false

  if (link.endsWith('/')) link = link.slice(0, -1)
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (link.startsWith('/')) link = link.slice(1)
  if (path.startsWith('/')) path = path.slice(1)

  return link === decodeURIComponent(path)
}
