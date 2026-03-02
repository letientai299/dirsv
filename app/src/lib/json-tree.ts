export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "object"
  | "array"

export interface JsonNodeInfo {
  path: string
  key: string
  value: JsonValue
  type: JsonType
  childCount: number
}

export function getType(value: JsonValue): JsonType {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  const t = typeof value
  if (t === "string") return "string"
  if (t === "number") return "number"
  if (t === "boolean") return "boolean"
  return "object"
}

export function getChildren(
  value: JsonValue,
  parentPath: string,
): JsonNodeInfo[] {
  if (value === null || typeof value !== "object") return []

  if (Array.isArray(value)) {
    return value.map((item, i) => {
      const path = parentPath ? `${parentPath}.${i}` : String(i)
      const type = getType(item)
      return {
        path,
        key: String(i),
        value: item,
        type,
        childCount: childCountOf(item, type),
      }
    })
  }

  return Object.entries(value).map(([key, val]) => {
    const path = parentPath ? `${parentPath}.${key}` : key
    const type = getType(val)
    return {
      path,
      key,
      value: val,
      type,
      childCount: childCountOf(val, type),
    }
  })
}

function childCountOf(value: JsonValue, type: JsonType): number {
  if (type === "array") return (value as JsonValue[]).length
  if (type === "object") return Object.keys(value as object).length
  return 0
}

/**
 * Precompute the set of visible paths for a given filter. A path is visible if
 * it matches (case-insensitive substring) or is an ancestor of a match.
 * Returns `null` when filter is empty (meaning everything is visible).
 */
export function computeVisiblePaths(
  allPaths: Set<string>,
  filter: string,
): Set<string> | null {
  if (!filter) return null
  const lower = filter.toLowerCase()
  const visible = new Set<string>()
  for (const p of allPaths) {
    if (!p.toLowerCase().includes(lower)) continue
    visible.add(p)
    // Mark all ancestors visible so tree structure is preserved
    let dot = p.indexOf(".")
    while (dot !== -1) {
      visible.add(p.slice(0, dot))
      dot = p.indexOf(".", dot + 1)
    }
  }
  return visible
}

/** Collect all dot-paths in the JSON tree. */
export function collectAllPaths(value: JsonValue, prefix = ""): Set<string> {
  const paths = new Set<string>()
  if (value === null || typeof value !== "object") return paths

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value)

  for (const [key, val] of entries) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.add(path)
    if (val !== null && typeof val === "object") {
      for (const child of collectAllPaths(val, path)) {
        paths.add(child)
      }
    }
  }
  return paths
}

/**
 * Walk the tree in render order, yielding only paths whose ancestors are all
 * expanded (and pass the visibility filter). Used for arrow-key navigation.
 */
export function computeFlatVisiblePaths(
  value: JsonValue,
  expanded: Set<string>,
  visible: Set<string> | null,
): string[] {
  const result: string[] = []
  if (value === null || typeof value !== "object") return result
  walkFlatPaths(value, "", expanded, visible, result)
  return result
}

function walkFlatPaths(
  v: JsonValue,
  parentPath: string,
  expanded: Set<string>,
  visible: Set<string> | null,
  result: string[],
) {
  for (const child of getChildren(v, parentPath)) {
    if (visible && !visible.has(child.path)) continue
    result.push(child.path)
    if (child.childCount > 0 && expanded.has(child.path)) {
      walkFlatPaths(child.value, child.path, expanded, visible, result)
    }
  }
}

export function serializeValue(value: JsonValue): string {
  if (typeof value === "string") return JSON.stringify(value)
  if (value === null || typeof value !== "object") return String(value)
  return JSON.stringify(value, null, 2)
}
