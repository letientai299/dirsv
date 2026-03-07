import { isRenderedAndUnchanged } from "./content-hash"
import { partitionByViewport, yieldToMain } from "./render-priority"
import { sanitizeSvg } from "./sanitize-svg"
import { getIsDark } from "./theme"

/** Render a single D2 source string to SVG. Lazy-loads the WASM engine. */
export async function renderD2(source: string): Promise<string> {
  const { D2 } = await import("@terrastruct/d2")
  const d2 = new D2()
  const result = await d2.compile(source)
  const svg = await d2.render(result.diagram, {
    ...result.renderOptions,
    noXMLTag: true,
    themeID: getIsDark() ? 200 : 0,
  })
  return svg
}

/**
 * Renders all `.d2-placeholder` elements inside `container` by
 * dynamically importing @terrastruct/d2 and calling compile/render.
 * Runs entirely client-side via WASM — no external server needed.
 *
 * Viewport-visible placeholders render first; offscreen ones follow
 * with main-thread yields between each.
 */
export async function renderD2Blocks(container: HTMLElement): Promise<void> {
  const placeholders =
    container.querySelectorAll<HTMLElement>(".d2-placeholder")
  if (placeholders.length === 0) return

  const { D2 } = await import("@terrastruct/d2")
  const d2 = new D2()
  const isDark = getIsDark()

  const [viewport, offscreen] = partitionByViewport(placeholders)

  for (const el of viewport) {
    await renderOne(d2, el, isDark)
  }

  for (const el of offscreen) {
    await yieldToMain()
    await renderOne(d2, el, isDark)
  }
}

async function renderOne(
  // biome-ignore lint/suspicious/noExplicitAny: D2 instance type not exported
  d2: any,
  el: HTMLElement,
  isDark: boolean,
): Promise<void> {
  const source = el.dataset["d2"]
  if (!source) return
  if (isRenderedAndUnchanged(el, source, "d2")) return

  try {
    const result = await d2.compile(source)
    const svg = await d2.render(result.diagram, {
      ...result.renderOptions,
      noXMLTag: true,
      themeID: isDark ? 200 : 0,
    })
    el.innerHTML = sanitizeSvg(svg)
    el.classList.add("d2-rendered", "diagram-rendered")
  } catch {
    el.textContent = "D2 render error"
    el.classList.add("d2-error", "diagram-error")
  }
}
