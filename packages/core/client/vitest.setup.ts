import { installMarkeeVitestSetup } from '@markee/vitest/setup'

installMarkeeVitestSetup({
  protectCustomElements: true,
  restoreMocks: true,
  clearBodyLoading: true,
  clearStorage: true,
  muteLitDevWarnings: true,
})
