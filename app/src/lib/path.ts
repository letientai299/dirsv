/** Strip last path segment: "/a/b/c" → "/a/b", "/" → "/" */
export function parentOf(path: string): string {
  return path.replace(/\/[^/]+\/?$/, "") || "/"
}

/** Like parentOf, but goes up two levels for index.html paths. */
export function parentOfFile(path: string): string {
  const dir = parentOf(path)
  return /\/index\.html?$/i.test(path) ? parentOf(dir) : dir
}
