import { PathHelpers } from './helpers/path.js'
import colors from 'colors/safe.js'

export const ROOT_DIR = process.cwd() || (process.env.INIT_CWD as string)

let clientFile = ''
try {
  clientFile = PathHelpers.sanitize(
    new URL(import.meta.resolve('@markee/client')).pathname,
  )
} catch (err) {
  void err
}
export const CLIENT_FILE = clientFile
export const CLIENT_DIR = PathHelpers.dirname(CLIENT_FILE)

export const MARKEE = colors.bold('Mark' + colors.blue('ee'))

let glyph = 0
let mode = 'default' as keyof typeof allGlyphs
const now = new Date()
if (now.getMonth() === 11 && now.getDate() >= 23) mode = 'christmas'
if (now.getMonth() === 10 && now.getDate() === 31) mode = 'halloween'

const allGlyphs = {
  default: [
    colors.bold(colors.gray('<') + colors.blue('/') + colors.gray('> ')),
  ],
  christmas: ['🎄  ', '🎁  '],
  halloween: ['🎃  ', '🦇  '],
}
const glyphs = allGlyphs[mode]
export const MARKEE_PREFIX = {
  get() {
    return glyphs[glyph++ % glyphs.length]
  },
  next() {
    return glyphs[(glyph + 1) % glyphs.length]
  },
}
