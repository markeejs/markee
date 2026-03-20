import { describe, expect, it } from 'vitest'

import * as pipeline from '@markee/pipeline'
import { clientPipeline } from './pipelines/client'
import { searchPipeline } from './pipelines/search'

describe('pipeline index', () => {
  it('re-exports the public pipeline builders', () => {
    expect(pipeline.clientPipeline).toBe(clientPipeline)
    expect(pipeline.searchPipeline).toBe(searchPipeline)
  })
})
