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
