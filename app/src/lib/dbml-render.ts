import { isRenderedAndUnchanged } from "./content-hash"
import { renderGraphviz } from "./graphviz-render"
import { partitionByViewport } from "./render-priority"
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

type DbmlJob = { el: HTMLElement; source: string }

type RenderResult =
  | { el: HTMLElement; ok: true; svg: string }
  | { el: HTMLElement; ok: false }

function renderJobBatch(
  run: (source: string, format: "dot") => string,
  jobs: DbmlJob[],
): Promise<RenderResult[]> {
  return Promise.all(
    jobs.map(({ el, source }) =>
      Promise.resolve()
        .then(() => {
          const dot = run(source, "dot")
          return renderGraphviz(dot)
        })
        .then((svg) => ({ el, ok: true as const, svg }))
        .catch(() => ({ el, ok: false as const })),
    ),
  )
}

function applyResults(results: RenderResult[]): void {
  for (const r of results) {
    if (r.ok) {
      r.el.innerHTML = sanitizeSvg(r.svg)
      r.el.classList.add("dbml-rendered")
    } else {
      r.el.textContent = "DBML render error"
      r.el.classList.add("dbml-error")
    }
  }
}

/**
 * Renders all `.dbml-placeholder` elements inside `container` by
 * converting DBML → DOT → SVG via @softwaretechnik/dbml-renderer
 * and @hpcc-js/wasm-graphviz.
 *
 * Viewport-visible jobs run as a batch first via Promise.all;
 * offscreen jobs follow in a second batch.
 */
export async function renderDbmlBlocks(container: HTMLElement): Promise<void> {
  const placeholders =
    container.querySelectorAll<HTMLElement>(".dbml-placeholder")
  if (placeholders.length === 0) return

  const { run } = await import("@softwaretechnik/dbml-renderer")

  const allJobs: DbmlJob[] = Array.from(placeholders).flatMap((el) => {
    const source = el.dataset["dbml"]
    if (!source) return []
    if (isRenderedAndUnchanged(el, source, "dbml")) return []
    return [{ el, source }]
  })

  const elToJob = new Map(allJobs.map((j) => [j.el, j]))

  const [vpEls, offEls] = partitionByViewport(allJobs.map((j) => j.el))

  const vpJobs = vpEls.flatMap((el) => {
    const j = elToJob.get(el)
    return j ? [j] : []
  })
  const offJobs = offEls.flatMap((el) => {
    const j = elToJob.get(el)
    return j ? [j] : []
  })

  applyResults(await renderJobBatch(run, vpJobs))
  applyResults(await renderJobBatch(run, offJobs))
}
