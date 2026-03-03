import { sanitizeSvg } from "./sanitize-svg"

const CDN = "https://esm.sh"
const VER = "0.6.0"
const WASM_CDN = "https://cdn.jsdelivr.net/npm"

/**
 * Load typst.ts from esm.sh CDN, bypassing the bundler entirely.
 * esm.sh rewrites bare imports to CDN URLs so the module graph resolves
 * in-browser without Vite's dep optimization.
 */
// biome-ignore lint/suspicious/noExplicitAny: $typst is loaded from CDN at runtime, no types available
const getTypst: () => Promise<any> = (() => {
  // biome-ignore lint/suspicious/noExplicitAny: see above
  let cached: Promise<any> | undefined
  return () => {
    if (!cached) {
      cached = (async () => {
        const { $typst } = await import(
          /* @vite-ignore */ `${CDN}/@myriaddreamin/typst.ts@${VER}`
        )
        $typst.setCompilerInitOptions({
          getModule: () =>
            `${WASM_CDN}/@myriaddreamin/typst-ts-web-compiler@${VER}/pkg/typst_ts_web_compiler_bg.wasm`,
        })
        $typst.setRendererInitOptions({
          getModule: () =>
            `${WASM_CDN}/@myriaddreamin/typst-ts-renderer@${VER}/pkg/typst_ts_renderer_bg.wasm`,
        })
        return $typst
      })()
    }
    return cached
  }
})()

/** Render a single Typst source string to SVG. */
export async function renderTypst(source: string): Promise<string> {
  const t = await getTypst()
  return await t.svg({ mainContent: source })
}

/**
 * Renders all `.typst-placeholder` elements inside `container`.
 * WASM loaded from CDN on first use — no bundling needed.
 */
export async function renderTypstBlocks(container: HTMLElement): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(
    ".typst-placeholder:not(.typst-rendered):not(.typst-error)",
  )
  if (placeholders.length === 0) return

  const t = await getTypst()

  for (const el of placeholders) {
    // biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
    const source = el.dataset["typst"]
    if (!source) continue

    try {
      const svg = await t.svg({ mainContent: source })
      el.innerHTML = sanitizeSvg(svg)
      el.classList.add("typst-rendered")
    } catch {
      el.textContent = "Typst render error"
      el.classList.add("typst-error")
    }
  }
}
