import { isRenderedAndUnchanged } from "./content-hash"
import { sanitizeSvg } from "./sanitize-svg"

let idCounter = 0

/**
 * Renders all `.mermaid-placeholder` elements inside `container` by
 * dynamically importing mermaid and calling `mermaid.render()`.
 * Theme-aware: reads `data-theme` from `<html>` or falls back to
 * `prefers-color-scheme`.
 */
export async function renderMermaidBlocks(
  container: HTMLElement,
): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".mermaid-placeholder",
  )
  if (placeholders.length === 0) return

  const { default: mermaid } = await import("mermaid")

  const isDark = getIsDark()
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    // Suppress mermaid's own error rendering — we handle errors ourselves
    suppressErrorRendering: true,
  })

  const jobs = Array.from(placeholders).flatMap((el) => {
    const source = getData(el, "mermaid")
    if (!source) return []
    if (isRenderedAndUnchanged(el, source, "mermaid")) return []
    return [{ el, source, graphId: `mermaid-${++idCounter}` }]
  })

  const results = await Promise.all(
    jobs.map(({ el, graphId, source }) =>
      mermaid
        .render(graphId, source)
        .then(({ svg }) => ({ el, ok: true as const, svg }))
        .catch(() => ({ el, ok: false as const })),
    ),
  )

  for (const r of results) {
    if (r.ok) {
      r.el.innerHTML = sanitizeSvg(r.svg)
      r.el.classList.add("mermaid-rendered")
    } else {
      r.el.textContent = "Mermaid render error for diagram"
      r.el.classList.add("mermaid-error")
    }
  }
}

function getData(el: HTMLElement, key: string): string | undefined {
  return el.dataset[key]
}

function getIsDark(): boolean {
  const explicit = getData(document.documentElement, "theme")
  if (explicit === "dark") return true
  if (explicit === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}
