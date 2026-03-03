import { sanitizeSvg } from "./sanitize-svg"

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

  const { Graphviz } = await import("@hpcc-js/wasm-graphviz")
  const graphviz = await Graphviz.load()

  const jobs = Array.from(placeholders).flatMap((el) => {
    // biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
    const source = el.dataset["graphviz"]
    if (!source) return []
    return [{ el, source }]
  })

  const results = await Promise.all(
    jobs.map(({ el, source }) =>
      Promise.resolve()
        .then(() => graphviz.dot(source))
        .then((svg) => ({ el, ok: true as const, svg }))
        .catch(() => ({ el, ok: false as const })),
    ),
  )

  for (const r of results) {
    if (r.ok) {
      r.el.innerHTML = sanitizeSvg(r.svg)
      r.el.classList.add("graphviz-rendered")
    } else {
      r.el.textContent = "Graphviz render error"
      r.el.classList.add("graphviz-error")
    }
  }
}
