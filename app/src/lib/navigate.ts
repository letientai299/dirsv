/** Normalize a path: resolve `.`/`..`, collapse slashes, strip trailing slash. */
export function normalizePath(raw: string, base: string): string {
  const absolute = raw.startsWith("/") ? raw : `${base}/${raw}`
  const parts = absolute.split("/")
  const resolved: string[] = []
  for (const p of parts) {
    if (p === "" || p === ".") continue
    if (p === "..") resolved.pop()
    else resolved.push(p)
  }
  return `/${resolved.join("/")}`
}

/** SPA navigation helper. Encodes each path segment for proper URL handling. */
export function navigate(to: string) {
  const normalized = normalizePath(to, "/")
  const encoded = normalized
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
  history.pushState(null, "", encoded)
  window.dispatchEvent(new PopStateEvent("popstate"))
}
