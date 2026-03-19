import { installMarkeeVitestSetup } from '@markee/vitest/setup'

installMarkeeVitestSetup({
  restoreMocks: true,
  clearBodyLoading: true,
  clearStorage: true,
})
