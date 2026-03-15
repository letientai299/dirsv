import { isRenderedAndUnchanged } from "./content-hash"
import { partitionByViewport, yieldToMain } from "./render-priority"

/**
 * Post-process `.katex-placeholder` elements by rendering them with KaTeX.
 * Runs after morphdom patches the DOM, outside the unified pipeline.
 *
 * Viewport-visible placeholders render first; offscreen batch follows
 * after a single yield (KaTeX is fast enough that per-element yields
 * would add overhead without benefit).
 */
export async function renderKatexBlocks(container: HTMLElement): Promise<void> {
  const placeholders =
    container.querySelectorAll<HTMLElement>(".katex-placeholder")
  if (placeholders.length === 0) return

  const katex = await import("katex")

  const [viewport, offscreen] = partitionByViewport(placeholders)

  for (const el of viewport) {
    renderOne(katex.default, el)
  }

  if (offscreen.length > 0) {
    await yieldToMain()
    for (const el of offscreen) {
      renderOne(katex.default, el)
    }
  }
}

/**
 * KaTeX's `split` environment only allows one `&` per row, but MathJax (and
 * standard LaTeX with amsmath) is more lenient.  `aligned` is a drop-in
 * superset that supports multiple alignment points.
 * https://katex.org/docs/support_table
 */
function normalizeTex(tex: string): string {
  if (!tex.includes("\\begin{split}")) return tex
  return tex
    .split("\\begin{split}")
    .join("\\begin{aligned}")
    .split("\\end{split}")
    .join("\\end{aligned}")
}

function renderOne(
  katex: { renderToString: (tex: string, opts: object) => string },
  el: HTMLElement,
): void {
  const tex = el.dataset["katex"]
  if (!tex) return
  if (isRenderedAndUnchanged(el, tex, "katex")) return

  const display = el.dataset["display"] === "true"

  try {
    el.innerHTML = katex.renderToString(normalizeTex(tex), {
      displayMode: display,
      throwOnError: false,
    })
    el.classList.add("katex-rendered")
  } catch {
    el.textContent = tex
    el.classList.add("katex-error")
  }
}
