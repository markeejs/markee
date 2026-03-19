import type { ViteUserConfig } from 'vitest/config'

export declare function createMarkeeVitestConfig(options?: {
  aliases?: NonNullable<ViteUserConfig['resolve']>['alias']
  test?: Partial<ViteUserConfig['test']>
}): ViteUserConfig
