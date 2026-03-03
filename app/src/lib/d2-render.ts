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
 */
export async function renderD2Blocks(container: HTMLElement): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".d2-placeholder:not(.d2-rendered):not(.d2-error)",
  )
  if (placeholders.length === 0) return

  const { D2 } = await import("@terrastruct/d2")
  const d2 = new D2()
  const isDark = getIsDark()

  for (const el of placeholders) {
    // biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
    const source = el.dataset["d2"]
    if (!source) continue

    try {
      const result = await d2.compile(source)
      const svg = await d2.render(result.diagram, {
        ...result.renderOptions,
        noXMLTag: true,
        themeID: isDark ? 200 : 0,
      })
      el.innerHTML = svg
      el.classList.add("d2-rendered")
    } catch {
      el.textContent = "D2 render error"
      el.classList.add("d2-error")
    }
  }
}

function getIsDark(): boolean {
  // biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
  const explicit = document.documentElement.dataset["theme"]
  if (explicit === "dark") return true
  if (explicit === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}
