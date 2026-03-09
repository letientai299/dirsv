import { navigate } from "./navigate"

/**
 * Resolve a relative URL path against the markdown file's parent directory.
 * Returns an absolute path (leading `/`) with any hash fragment preserved.
 * External and already-absolute URLs pass through unchanged.
 */
export function resolveRelativeUrl(href: string, mdPath: string): string {
  // External URL — pass through.
  if (/^(?:[a-z]+:)?\/\//i.test(href)) return href

  // Already absolute — pass through.
  if (href.startsWith("/")) return href

  // Anchor-only — pass through.
  if (href.startsWith("#")) return href

  // Directory containing the markdown file (e.g., "/docs/README.md" → "/docs")
  const dir = mdPath.replace(/\/[^/]*$/, "") || ""

  // Combine dir + href and resolve `.` / `..` segments via URL constructor.
  const base = `http://x${dir.endsWith("/") ? dir : `${dir}/`}`
  const resolved = new URL(href, base)
  return resolved.pathname + resolved.hash
}

/** Rewrite relative `src` on `<img>` and `<video><source>` to `/api/raw/`. */
export function rewriteMediaSrc(el: HTMLElement, mdPath: string): void {
  for (const media of el.querySelectorAll<HTMLImageElement | HTMLSourceElement>(
    "img[src], video source[src]",
  )) {
    const src = media.getAttribute("src")
    if (!src || /^(?:[a-z]+:)?\/\//i.test(src) || src.startsWith("/api/"))
      continue

    const resolved = resolveRelativeUrl(src, mdPath)
    media.setAttribute("src", `/api/raw${resolved}`)
  }
}

/**
 * Click handler for `<article>` — intercepts clicks on relative `<a>` tags
 * and performs SPA navigation instead of a full page reload.
 */
export function handleRelativeLinkClick(e: MouseEvent, mdPath: string): void {
  // Modifier keys → let browser handle (new tab, etc.)
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

  const anchor = (e.target as HTMLElement).closest?.("a")
  if (!anchor) return

  const href = anchor.getAttribute("href")
  if (!href) return

  // External links — let browser handle.
  if (/^(?:[a-z]+:)?\/\//i.test(href)) return

  // Anchor-only links — let browser handle (scroll to heading).
  if (href.startsWith("#")) return

  e.preventDefault()
  navigate(resolveRelativeUrl(href, mdPath))
}
