import { renderGraphviz } from "./graphviz-render"
import { sanitizeSvg } from "./sanitize-svg"

/**
 * Convert DBML source to DOT format using @softwaretechnik/dbml-renderer.
 * The `run(source, "dot")` path is pure JS — no Node built-ins needed.
 * The `"svg"` path requires @aduh95/viz.js which uses Node's fs/path/crypto,
 * so we produce DOT here and render it with our existing Graphviz WASM.
 */
async function dbmlToDot(source: string): Promise<string> {
  const { run } = await import("@softwaretechnik/dbml-renderer")
  return run(source, "dot")
}

/** Render a single DBML source string to SVG. */
export async function renderDbml(source: string): Promise<string> {
  const dot = await dbmlToDot(source)
  return renderGraphviz(dot)
}

/**
 * Renders all `.dbml-placeholder` elements inside `container` by
 * converting DBML → DOT → SVG via @softwaretechnik/dbml-renderer
 * and @hpcc-js/wasm-graphviz.
 */
export async function renderDbmlBlocks(container: HTMLElement): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".dbml-placeholder:not(.dbml-rendered):not(.dbml-error)",
  )
  if (placeholders.length === 0) return

  const { run } = await import("@softwaretechnik/dbml-renderer")

  for (const el of placeholders) {
    // biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
    const source = el.dataset["dbml"]
    if (!source) continue

    try {
      const dot = run(source, "dot")
      const svg = await renderGraphviz(dot)
      el.innerHTML = sanitizeSvg(svg)
      el.classList.add("dbml-rendered")
    } catch {
      el.textContent = "DBML render error"
      el.classList.add("dbml-error")
    }
  }
}
