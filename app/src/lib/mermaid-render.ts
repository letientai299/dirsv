import { isRenderedAndUnchanged } from "./content-hash"
import { partitionByViewport, yieldToMain } from "./render-priority"
import { sanitizeSvg } from "./sanitize-svg"
import { getIsDark } from "./theme"

let idCounter = 0

/**
 * Renders all `.mermaid-placeholder` elements inside `container` by
 * dynamically importing mermaid and calling `mermaid.render()`.
 * Theme-aware: reads `data-theme` from `<html>` or falls back to
 * `prefers-color-scheme`.
 *
 * Viewport-visible placeholders render first; offscreen ones follow
 * with main-thread yields between each to keep the page responsive.
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

  const [viewport, offscreen] = partitionByViewport(placeholders)

  // Mermaid uses shared DOM state internally — concurrent render() calls break
  // certain diagram types (ER, git graph, etc.). Render sequentially.
  for (const el of viewport) {
    await renderOne(mermaid, el)
  }

  for (const el of offscreen) {
    await yieldToMain()
    await renderOne(mermaid, el)
  }
}

async function renderOne(
  // biome-ignore lint/suspicious/noExplicitAny: mermaid's default export type is complex
  mermaid: any,
  el: HTMLElement,
): Promise<void> {
  const source = getData(el, "mermaid")
  if (!source) return
  if (isRenderedAndUnchanged(el, source, "mermaid")) return

  const graphId = `mermaid-${++idCounter}`
  try {
    // Mermaid's D3 internals emit noisy console.warn calls for style mappings
    // on elements without matching data fields (e.g. "ele `users-igw` has no
    // mapping for property `label`"). Suppress during render.
    // biome-ignore lint/suspicious/noConsole: intentionally patching console.warn to suppress mermaid D3 noise
    const origWarn = console.warn
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("Do not assign mappings to elements without")
      )
        return
      origWarn.apply(console, args)
    }
    let svg: string
    try {
      ;({ svg } = await mermaid.render(graphId, source))
    } finally {
      console.warn = origWarn
    }
    el.innerHTML = sanitizeSvg(svg)
    el.classList.add("mermaid-rendered", "diagram-rendered")
  } catch {
    el.textContent = "Mermaid render error for diagram"
    el.classList.add("mermaid-error", "diagram-error")
  }
}

function getData(el: HTMLElement, key: string): string | undefined {
  return el.dataset[key]
}
