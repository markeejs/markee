import { installMarkeeVitestSetup } from '@markee/vitest/setup'

installMarkeeVitestSetup({
  protectCustomElements: true,
  restoreMocks: true,
  muteLitDevWarnings: true,
})
