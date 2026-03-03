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

  // Mermaid uses shared DOM state internally — concurrent render() calls break
  // certain diagram types (ER, git graph, etc.). Render sequentially.
  for (const el of placeholders) {
    const source = getData(el, "mermaid")
    if (!source) continue
    if (isRenderedAndUnchanged(el, source, "mermaid")) continue

    const graphId = `mermaid-${++idCounter}`
    try {
      const { svg } = await mermaid.render(graphId, source)
      el.innerHTML = sanitizeSvg(svg)
      el.classList.add("mermaid-rendered")
    } catch {
      el.textContent = "Mermaid render error for diagram"
      el.classList.add("mermaid-error")
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
