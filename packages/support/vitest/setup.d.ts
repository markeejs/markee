export interface MarkeeVitestSetupOptions {
  protectCustomElements?: boolean
  restoreMocks?: boolean
  clearBodyLoading?: boolean
  clearStorage?: boolean
  muteLitDevWarnings?: boolean
}

export declare function installMarkeeVitestSetup(
  options?: MarkeeVitestSetupOptions,
): void
