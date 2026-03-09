/** Normalize a path: resolve `.`/`..`, collapse slashes. Preserves trailing slash. */
export function normalizePath(raw: string, base: string): string {
  const absolute = raw.startsWith("/") ? raw : `${base}/${raw}`
  const trailing = absolute.length > 1 && absolute.endsWith("/")
  const parts = absolute.split("/")
  const resolved: string[] = []
  for (const p of parts) {
    if (p === "" || p === ".") continue
    if (p === "..") resolved.pop()
    else resolved.push(p)
  }
  const result = `/${resolved.join("/")}`
  return trailing && result !== "/" ? `${result}/` : result
}

/** Percent-encode each segment of a normalized path for use in the URL bar. */
function encodePath(normalized: string): string {
  return normalized
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
}

/** SPA navigation helper. Encodes each path segment for proper URL handling. */
export function navigate(to: string) {
  const normalized = normalizePath(to, "/")
  history.pushState(null, "", encodePath(normalized))
  window.dispatchEvent(new PopStateEvent("popstate"))
}

/** Replace the current history entry without creating a new back-button stop. */
export function replaceLocation(path: string) {
  history.replaceState(null, "", encodePath(path))
}
