import path from 'path'

/**
 * Return a safe version of `path.join` where parts can start with / without resetting
 * to root. Replace Windows separators with Unix separators in the process
 * @param first - first segment to join
 * @param parts - rest of segments to join
 */
function concat(first: string, ...parts: string[]) {
  const sanitized = parts.map((p) => (p.startsWith('/') ? '.' + p : p))

  return path
    .join(first, ...sanitized)
    .replaceAll(path.win32.sep, path.posix.sep)
}

/**
 * Helper function to sanitize a path to remove Windows driver-letters
 * @param path - path to sanitize
 */
export function sanitize(path: string) {
  return path.startsWith(':/', 2) ? path.slice(3) : path
}

/**
 * Re-export required path utilities to keep a single path import
 * across the codebase
 */
export const PathHelpers = {
  concat,
  sanitize,
  resolve: path.resolve.bind(path),
  dirname: path.dirname.bind(path),
  basename: path.basename.bind(path),
  relative: path.relative.bind(path),
  posix: path.posix,
  win32: path.win32,
  sep: path.sep,
}
