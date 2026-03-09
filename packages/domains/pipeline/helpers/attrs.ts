import parseAttrs from 'attributes-parser'

export function parseAttributes(
  attr: string,
  destination: Record<string, string | number | boolean | string[]> = {},
) {
  const parsed = parseAttrs(attr)

  for (const key in parsed) {
    destination[key] = parsed[key] as string | number | boolean | string[]

    if (key === 'class') {
      destination.className = [
        ...((destination.className as string[]) ?? []),
        ...(parsed[key] as string).split(' '),
      ].filter((e, i, a) => a.indexOf(e) === i)
      delete destination.class
    }
  }

  return destination
}
