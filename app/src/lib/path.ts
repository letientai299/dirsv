/** Strip last path segment, returning parent with trailing slash. */
export function parentOf(path: string): string {
  const stripped = path.replace(/\/[^/]+\/?$/, "") || "/"
  return stripped === "/" ? "/" : `${stripped}/`
}

/** Strip leading slash to get a relative watch prefix for the WS API. */
export function watchPrefix(path: string): string {
  return path.replace(/^\//, "")
}
