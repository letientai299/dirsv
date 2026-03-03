/** Render a single Graphviz source string to SVG. Lazy-loads the WASM engine. */
export async function renderGraphviz(source: string): Promise<string> {
  const { Graphviz } = await import("@hpcc-js/wasm-graphviz")
  const graphviz = await Graphviz.load()
  return graphviz.dot(source)
}

/**
 * Renders all `.graphviz-placeholder` elements inside `container` by
 * dynamically importing @hpcc-js/wasm-graphviz and calling `dot()`.
 * Runs entirely client-side via WASM — no external server needed.
 */
export async function renderGraphvizBlocks(
  container: HTMLElement,
): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".graphviz-placeholder:not(.graphviz-rendered):not(.graphviz-error)",
  )
  if (placeholders.length === 0) return

  for (const el of placeholders) {
    // biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
    const source = el.dataset["graphviz"]
    if (!source) continue

    try {
      const svg = await renderGraphviz(source)
      el.innerHTML = svg
      el.classList.add("graphviz-rendered")
    } catch {
      el.textContent = "Graphviz render error"
      el.classList.add("graphviz-error")
    }
  }
}
