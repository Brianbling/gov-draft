/**
 * Immutable deep get/set on dot-separated paths (e.g. "content.body.style.size").
 *
 * `setDeep` clones only the objects along the target path, returning a new root
 * so React state updates trigger re-renders without mutating the source model.
 */

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Read the value at `path`, or `undefined` if any segment is missing. */
export function getDeep(root: unknown, path: string): unknown {
  if (path === "") return root
  return path.split(".").reduce<unknown>((obj, key) => {
    return isRecord(obj) ? obj[key] : undefined
  }, root)
}

/**
 * Return a new object tree with `path` set to `value`. Intermediate segments
 * that are missing or non-object are created as fresh records. The input is
 * never mutated.
 */
export function setDeep(
  root: unknown,
  path: string,
  value: unknown
): UnknownRecord {
  const keys = path.split(".")
  const base: UnknownRecord = isRecord(root) ? { ...root } : {}

  if (keys.length === 1) {
    base[keys[0]!] = value
    return base
  }

  const [head, ...rest] = keys
  const child = isRecord(base[head!]) ? base[head!] : {}
  base[head!] = setDeep(child, rest.join("."), value)
  return base
}
