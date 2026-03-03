/**
 * Post-process `.katex-placeholder` elements by rendering them with KaTeX.
 * Runs after morphdom patches the DOM, outside the unified pipeline.
 */
export async function renderKatexBlocks(container: HTMLElement): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".katex-placeholder:not(.katex-rendered)",
  )
  if (placeholders.length === 0) return

  const katex = await import("katex")

  for (const el of placeholders) {
    const tex = el.dataset["katex"]
    if (!tex) continue

    const display = el.dataset["display"] === "true"

    try {
      el.innerHTML = katex.default.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
      })
      el.classList.add("katex-rendered")
    } catch {
      el.textContent = tex
      el.classList.add("katex-error")
    }
  }
}
