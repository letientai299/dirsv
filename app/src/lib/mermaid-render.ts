import { isRenderedAndUnchanged } from "./content-hash"
import { partitionByViewport, yieldToMain } from "./render-priority"
import { sanitizeSvg } from "./sanitize-svg"
import { getIsDark } from "./theme"

let idCounter = 0

// biome-ignore lint/suspicious/noExplicitAny: mermaid's default export type is complex
type Mermaid = any

/** Import mermaid and configure it for the current theme. */
async function initMermaid(): Promise<Mermaid> {
  const { default: mermaid } = await import("mermaid")
  mermaid.initialize({
    startOnLoad: false,
    theme: getIsDark() ? "dark" : "default",
    // Suppress mermaid's own error rendering — we handle errors ourselves
    suppressErrorRendering: true,
  })
  return mermaid
}

/**
 * Mermaid's D3 internals emit noisy console.warn calls for style mappings
 * on elements without matching data fields. Suppress during render.
 */
async function quietRender(
  mermaid: Mermaid,
  graphId: string,
  source: string,
): Promise<string> {
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
  try {
    const { svg } = await mermaid.render(graphId, source)
    return sanitizeSvg(svg)
  } finally {
    console.warn = origWarn
  }
}

/**
 * Render Mermaid source to an SVG string.
 * Used by `DiagramView` for standalone `.mmd` / `.mermaid` files.
 */
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await initMermaid()
  return quietRender(mermaid, `mermaid-${++idCounter}`, source)
}

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

  const mermaid = await initMermaid()
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

async function renderOne(mermaid: Mermaid, el: HTMLElement): Promise<void> {
  const source = el.dataset["mermaid"]
  if (!source) return
  if (isRenderedAndUnchanged(el, source, "mermaid")) return

  const graphId = `mermaid-${++idCounter}`
  try {
    el.innerHTML = await quietRender(mermaid, graphId, source)
    el.classList.add("mermaid-rendered", "diagram-rendered")
  } catch {
    el.textContent = "Mermaid render error for diagram"
    el.classList.add("mermaid-error", "diagram-error")
  }
}
