import { matchesOperationSelector, type ActiveFilter } from './base-layout'
import { sanitizeFilterValue } from './helpers'

export type SwaggerUiFilters = {
  tag: string
  operation: string
  schema: string
}

export function resolveActiveFilter(
  filters: SwaggerUiFilters,
): ActiveFilter | null {
  const candidates: ActiveFilter[] = []

  const tag = sanitizeFilterValue(filters.tag)
  if (tag) candidates.push({ type: 'tag', value: tag })

  const operation = sanitizeFilterValue(filters.operation)
  if (operation) candidates.push({ type: 'operation', value: operation })

  const schema = sanitizeFilterValue(filters.schema)
  if (schema) candidates.push({ type: 'schema', value: schema })

  if (candidates.length > 1) {
    throw new Error(
      'Use only one filter per fence: tag=..., operation=..., or schema=....',
    )
  }

  return candidates[0] ?? null
}

const httpMethods = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  'trace',
])

function eachSpecOperation(
  spec: Record<string, any>,
  visitor: (args: {
    path: string
    method: string
    operation: Record<string, any>
  }) => boolean | void,
) {
  const paths = spec.paths
  if (!paths || typeof paths !== 'object') return false

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue

    for (const [methodKey, operation] of Object.entries(
      pathItem as Record<string, any>,
    )) {
      const method = methodKey.toLowerCase()
      if (!httpMethods.has(method)) continue
      if (!operation || typeof operation !== 'object') continue

      const stop = visitor({
        path,
        method,
        operation: operation as Record<string, any>,
      })

      if (stop === true) return true
    }
  }

  return false
}

function hasTag(spec: Record<string, any>, requestedTag: string) {
  const tag = requestedTag.trim().toLowerCase()
  if (!tag) return false

  return eachSpecOperation(spec, ({ operation }) => {
    const tags = Array.isArray(operation.tags) ? operation.tags : []
    return tags.some((value) => String(value).toLowerCase() === tag)
  })
}

function hasOperation(spec: Record<string, any>, requestedOperation: string) {
  const selector = sanitizeFilterValue(requestedOperation)
  if (!selector) return false

  return eachSpecOperation(spec, ({ path, method, operation }) =>
    matchesOperationSelector({
      selector,
      path,
      method,
      operationId: String(operation.operationId ?? ''),
    }),
  )
}

function findSchemaInSpec(spec: Record<string, any>, requestedSchema: string) {
  const requested = requestedSchema.trim().toLowerCase()
  if (!requested) return ''

  const schemas = spec.components?.schemas
  if (schemas && typeof schemas === 'object') {
    const match = Object.keys(schemas).find(
      (schemaName) => schemaName.toLowerCase() === requested,
    )
    if (match) return match
  }

  const definitions = spec.definitions
  if (definitions && typeof definitions === 'object') {
    const match = Object.keys(definitions).find(
      (schemaName) => schemaName.toLowerCase() === requested,
    )
    if (match) return match
  }

  return ''
}

export function validateFilter(
  spec: Record<string, any>,
  filter: ActiveFilter | null,
): ActiveFilter | null {
  if (!filter) return null

  if (filter.type === 'tag') {
    if (!hasTag(spec, filter.value)) {
      throw new Error(`No operations matched tag "${filter.value}".`)
    }
    return filter
  }

  if (filter.type === 'operation') {
    if (!hasOperation(spec, filter.value)) {
      throw new Error(`No operations matched operation "${filter.value}".`)
    }
    return filter
  }

  const schemaName = findSchemaInSpec(spec, filter.value)
  if (!schemaName) {
    throw new Error(`Schema "${filter.value}" was not found.`)
  }

  return {
    type: 'schema',
    value: schemaName,
  }
}
