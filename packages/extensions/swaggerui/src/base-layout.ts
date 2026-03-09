export type ActiveFilter =
  | {
      type: 'tag'
      value: string
    }
  | {
      type: 'operation'
      value: string
    }
  | {
      type: 'schema'
      value: string
    }

type TagMatch = {
  tagName: string
  tagObj: any
}

type OperationMatch = {
  tagName: string
  operationObj: any
}

function parseOperationSelector(value: string) {
  const selector = value.trim().toLowerCase()

  const methodAndPath = selector.match(
    /^(get|post|put|delete|patch|head|options|trace)\s+(.+)$/,
  )
  if (methodAndPath) {
    return {
      raw: selector,
      method: methodAndPath[1],
      path: methodAndPath[2],
    }
  }

  const methodColonPath = selector.match(
    /^(get|post|put|delete|patch|head|options|trace):(.+)$/,
  )
  if (methodColonPath) {
    return {
      raw: selector,
      method: methodColonPath[1],
      path: methodColonPath[2],
    }
  }

  return {
    raw: selector,
    method: '',
    path: '',
  }
}

export function matchesOperationSelector(args: {
  selector: string
  path: string
  method: string
  operationId: string
}) {
  const parsed = parseOperationSelector(args.selector)
  const path = args.path.trim().toLowerCase()
  const method = args.method.trim().toLowerCase()
  const operationId = args.operationId.trim().toLowerCase()

  if (!parsed.raw) return true

  if (operationId && operationId === parsed.raw) return true

  if (`${method} ${path}` === parsed.raw) return true

  if (`${method}:${path}` === parsed.raw) return true

  if (parsed.method && parsed.path) {
    return method === parsed.method && path === parsed.path
  }

  return path === parsed.raw
}

function getSystemFromProps(props: any) {
  if (props && typeof props.getSystem === 'function') {
    return props.getSystem()
  }
  return null
}

function getReactFromProps(props: any) {
  const system = getSystemFromProps(props)
  return system?.React ?? null
}

function getImmutableFromProps(props: any) {
  const system = getSystemFromProps(props)
  return system?.Im ?? system?.Immutable ?? null
}

function toImmutableList(props: any, values: string[]) {
  const Im = getImmutableFromProps(props)
  if (Im?.List) return Im.List(values)
  return values
}

function toImmutableMap(props: any) {
  const Im = getImmutableFromProps(props)
  if (Im?.Map) return Im.Map()
  return {}
}

function findTagEntry(
  taggedOperations: any,
  requestedTag: string,
): TagMatch | null {
  if (!taggedOperations || typeof taggedOperations.forEach !== 'function') {
    return null
  }

  const wanted = requestedTag.trim().toLowerCase()
  if (!wanted) return null

  let match: TagMatch | null = null

  taggedOperations.forEach((tagObj: any, tagName: string) => {
    if (match) return
    if (String(tagName).toLowerCase() !== wanted) return
    match = {
      tagName: String(tagName),
      tagObj,
    }
  })

  return match
}

function renderTagContent(
  props: any,
  tagName: string,
  tagObj: any,
  React: any,
) {
  const validOperationMethods = props.specSelectors?.validOperationMethods?.()
  const OperationContainer = props.getComponent?.('OperationContainer', true)
  const operations = tagObj?.get?.('operations')

  if (
    !OperationContainer ||
    !operations ||
    typeof operations.map !== 'function'
  ) {
    return null
  }

  const renderedOperations = operations
    .map((op: any) => {
      const path = String(op?.get?.('path') ?? '')
      const method = String(op?.get?.('method') ?? '').toLowerCase()

      if (
        validOperationMethods &&
        typeof validOperationMethods.indexOf === 'function' &&
        validOperationMethods.indexOf(method) === -1
      ) {
        return null
      }

      return React.createElement(OperationContainer, {
        key: `${path}-${method}`,
        op,
        path,
        method,
        tag: tagName,
      })
    })
    .toArray()
    .filter(Boolean)

  return React.createElement(
    'div',
    { className: 'operation-tag-content' },
    renderedOperations,
  )
}

function findOperationEntry(
  taggedOperations: any,
  selector: string,
): OperationMatch | null {
  if (!taggedOperations || typeof taggedOperations.forEach !== 'function') {
    return null
  }

  let match: OperationMatch | null = null

  taggedOperations.forEach((tagObj: any, tagName: string) => {
    if (match) return

    const operations = tagObj?.get?.('operations')
    if (!operations || typeof operations.forEach !== 'function') return

    operations.forEach((operationObj: any) => {
      if (match) return

      const path = String(operationObj?.get?.('path') ?? '')
      const method = String(operationObj?.get?.('method') ?? '').toLowerCase()
      const operationId = String(
        operationObj?.get?.('operation')?.get?.('operationId') ?? '',
      )

      if (!matchesOperationSelector({ selector, path, method, operationId })) {
        return
      }

      match = {
        tagName: String(tagName),
        operationObj,
      }
    })
  })

  return match
}

function findSchemaNameFromDefinitions(
  definitions: any,
  requestedSchema: string,
) {
  if (!definitions || typeof definitions.forEach !== 'function') return ''

  const requested = requestedSchema.trim().toLowerCase()
  if (!requested) return ''

  let match = ''

  definitions.forEach((_schema: any, schemaName: string) => {
    if (match) return
    if (String(schemaName).toLowerCase() !== requested) return
    match = String(schemaName)
  })

  return match
}

function createSchemaReloader(React: any) {
  return function SchemaReloader(props: any) {
    const [, reload] = React.useState(0)

    React.useEffect(() => {
      let tick = 0
      const interval = window.setInterval(() => {
        tick += 1
        reload((value: number) => value + 1)
        if (tick >= 20) {
          window.clearInterval(interval)
        }
      }, 250)

      return () => {
        window.clearInterval(interval)
      }
    }, [])

    React.useEffect(() => {
      if (!props.schema?.size && props.rawSchema?.size > 0) {
        props.loadSchema?.()
      }
    })

    return props.children ?? null
  }
}

function renderFilteredLayout(props: any, filter: ActiveFilter) {
  const React = getReactFromProps(props)
  if (!React) return null

  if (filter.type === 'tag') {
    const taggedOperations = props.specSelectors?.taggedOperations?.()
    const match = findTagEntry(taggedOperations, filter.value)
    if (!match) return null

    return React.createElement(
      'div',
      { className: 'swagger-ui' },
      renderTagContent(props, match.tagName, match.tagObj, React),
    )
  }

  if (filter.type === 'operation') {
    const taggedOperations = props.specSelectors?.taggedOperations?.()
    const match = findOperationEntry(taggedOperations, filter.value)
    if (!match) return null

    const validOperationMethods = props.specSelectors?.validOperationMethods?.()
    const OperationContainer = props.getComponent?.('OperationContainer', true)
    const path = String(match.operationObj?.get?.('path') ?? '')
    const method = String(
      match.operationObj?.get?.('method') ?? '',
    ).toLowerCase()

    if (
      !OperationContainer ||
      (validOperationMethods &&
        typeof validOperationMethods.indexOf === 'function' &&
        validOperationMethods.indexOf(method) === -1)
    ) {
      return null
    }

    return React.createElement(
      'div',
      { className: 'swagger-ui' },
      React.createElement(OperationContainer, {
        key: `${path}-${method}`,
        op: match.operationObj,
        path,
        method,
        tag: match.tagName,
      }),
    )
  }

  const specSelectors = props.specSelectors
  const getConfigs = props.getConfigs
  const definitions = specSelectors?.definitions?.()
  const defaultModelsExpandDepth = Number(
    getConfigs?.()?.defaultModelsExpandDepth ?? 1,
  )

  if (!definitions?.size || defaultModelsExpandDepth < 0) {
    return null
  }

  const schemaName = findSchemaNameFromDefinitions(definitions, filter.value)
  if (!schemaName) return null

  const isOAS3 = Boolean(specSelectors?.isOAS3?.())
  const fullPath = isOAS3
    ? ['components', 'schemas', schemaName]
    : ['definitions', schemaName]

  const schemaValue = specSelectors?.specResolvedSubtree?.(fullPath) ?? null
  const rawSchemaValue = specSelectors?.specJson?.()?.getIn?.(fullPath) ?? null

  const schema = schemaValue ?? null
  const rawSchema = rawSchemaValue ?? null
  const displayName =
    schema?.get?.('title') || rawSchema?.get?.('title') || schemaName

  const ModelWrapper = props.getComponent?.('ModelWrapper')
  if (!ModelWrapper) return null

  const SchemaReloader = createSchemaReloader(React)

  return React.createElement(
    'div',
    { className: 'swagger-ui' },
    React.createElement(
      SchemaReloader,
      {
        schema,
        rawSchema,
        loadSchema: () => props.specActions?.requestResolvedSubtree?.(fullPath),
      },
      React.createElement(ModelWrapper, {
        name: schemaName,
        expandDepth: defaultModelsExpandDepth,
        schema: schema ?? toImmutableMap(props),
        displayName,
        fullPath,
        getComponent: props.getComponent,
        specSelectors,
        specPath: toImmutableList(props, fullPath),
        getConfigs,
        layoutSelectors: props.layoutSelectors,
        layoutActions: props.layoutActions,
        includeReadOnly: true,
        includeWriteOnly: true,
      }),
    ),
  )
}

export function createFilterLayoutPlugin(filter: ActiveFilter) {
  return () => ({
    components: {
      BaseLayout: (props: any) => renderFilteredLayout(props, filter),
    },
  })
}
