import { isRenderedAndUnchanged } from "./content-hash"
import { partitionByViewport } from "./render-priority"
import { sanitizeSvg } from "./sanitize-svg"

/** Render a single Graphviz source string to SVG. Lazy-loads the WASM engine. */
export async function renderGraphviz(source: string): Promise<string> {
  const { Graphviz } = await import("@hpcc-js/wasm-graphviz")
  const graphviz = await Graphviz.load()
  return graphviz.dot(source)
}

type GraphvizJob = { el: HTMLElement; source: string }

function collectJobs(
  placeholders: Iterable<HTMLElement>,
  key: string,
): GraphvizJob[] {
  return Array.from(placeholders).flatMap((el) => {
    const source = el.dataset[key]
    if (!source) return []
    if (isRenderedAndUnchanged(el, source, key)) return []
    return [{ el, source }]
  })
}

type RenderResult =
  | { el: HTMLElement; ok: true; svg: string }
  | { el: HTMLElement; ok: false }

function renderJobBatch(
  graphviz: { dot: (source: string) => string },
  jobs: GraphvizJob[],
): Promise<RenderResult[]> {
  return Promise.all(
    jobs.map(({ el, source }) =>
      Promise.resolve()
        .then(() => graphviz.dot(source))
        .then((svg) => ({ el, ok: true as const, svg }))
        .catch(() => ({ el, ok: false as const })),
    ),
  )
}

function applyResults(results: RenderResult[], cls: string): void {
  for (const r of results) {
    if (r.ok) {
      r.el.innerHTML = sanitizeSvg(r.svg)
      r.el.classList.add(`${cls}-rendered`, "diagram-rendered")
    } else {
      r.el.textContent = `${cls.charAt(0).toUpperCase() + cls.slice(1)} render error`
      r.el.classList.add(`${cls}-error`, "diagram-error")
    }
  }
}

/**
 * Renders all `.graphviz-placeholder` elements inside `container` by
 * dynamically importing @hpcc-js/wasm-graphviz and calling `dot()`.
 * Runs entirely client-side via WASM — no external server needed.
 *
 * Viewport-visible jobs run as a batch first via Promise.all;
 * offscreen jobs follow in a second batch.
 */
export async function renderGraphvizBlocks(
  container: HTMLElement,
): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".graphviz-placeholder",
  )
  if (placeholders.length === 0) return

  const { Graphviz } = await import("@hpcc-js/wasm-graphviz")
  const graphviz = await Graphviz.load()

  const allJobs = collectJobs(placeholders, "graphviz")
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

  applyResults(await renderJobBatch(graphviz, vpJobs), "graphviz")
  applyResults(await renderJobBatch(graphviz, offJobs), "graphviz")
}
