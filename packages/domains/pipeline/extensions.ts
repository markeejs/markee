import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root as MDAst } from 'mdast'
import type { Root as HAst } from 'hast'

const remarkExtensions: Record<string, [Plugin<any[], MDAst, MDAst>, any[]]> =
  {}
const rehypeExtensions: Record<string, [Plugin<any[], HAst, HAst>, any[]]> = {}

/**
 * Handle custom remark extensions
 */
export const withRemarkExtensions = <T>(base: T): T =>
  Object.values(remarkExtensions).reduce(
    (acc: any, [ext, params]: any) => acc.use(ext, ...params),
    base,
  )

/**
 * Handle custom rehype extensions
 */
export const withRehypeExtensions = <T>(base: T): T =>
  Object.values(rehypeExtensions).reduce(
    (acc: any, [ext, params]: any) => acc.use(ext, ...params),
    base,
  )

export const markdownPipeline = {
  visit,
  remark<Args extends any[]>(
    key: string,
    pluggable: Plugin<Args, MDAst, MDAst>,
    ...args: Args
  ) {
    remarkExtensions[key] = [pluggable, args]
  },
  rehype<Args extends any[]>(
    key: string,
    pluggable: Plugin<Args, HAst, HAst>,
    ...args: Args
  ) {
    rehypeExtensions[key] = [pluggable, args]
  },
}
