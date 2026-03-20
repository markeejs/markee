import { installMarkeeVitestSetup } from '@markee/vitest/setup'

installMarkeeVitestSetup({
  clearStorage: true,
  protectCustomElements: true,
  restoreMocks: true,
})
