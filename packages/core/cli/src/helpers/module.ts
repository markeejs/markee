import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const ModuleHelpers = {
  resolve(specifier: string) {
    return require.resolve(specifier)
  },
}
