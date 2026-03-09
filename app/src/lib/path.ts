/** Strip last path segment, returning parent with trailing slash. */
export function parentOf(path: string): string {
  const stripped = path.replace(/\/[^/]+\/?$/, "") || "/"
  return stripped === "/" ? "/" : `${stripped}/`
}
