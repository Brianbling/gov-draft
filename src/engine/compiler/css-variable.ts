const CAMEL_CASE_SEGMENT_PATTERN = /([a-z0-9])([A-Z])/g

const cssCustomPropertyCache = new Map<string, string>()

function normalizePathSegment(segment: string): string {
  return segment
    .replace(CAMEL_CASE_SEGMENT_PATTERN, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

export function toCssCustomProperty(path: string): string {
  const cached = cssCustomPropertyCache.get(path)
  if (cached !== undefined) {
    return cached
  }

  const normalizedPath = path
    .trim()
    .split('.')
    .map((segment) => normalizePathSegment(segment))
    .filter((segment) => segment.length > 0)
    .join('-')

  const result = `--${normalizedPath}`
  cssCustomPropertyCache.set(path, result)
  return result
}
