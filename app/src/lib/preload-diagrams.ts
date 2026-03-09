/**
 * Scan raw markdown for fenced code languages and inline math, then
 * fire dynamic imports for the matching diagram/rendering bundles.
 * The browser module cache ensures later import() calls in the actual
 * renderers resolve instantly.
 */

const DIAGRAM_IMPORTS: Record<string, () => Promise<unknown>> = {
  mermaid: () => import("mermaid"),
  d2: () => import("@terrastruct/d2"),
  graphviz: () => import("@hpcc-js/wasm-graphviz"),
  dot: () => import("@hpcc-js/wasm-graphviz"),
  dbml: () =>
    Promise.all([
      import("@softwaretechnik/dbml-renderer"),
      import("@hpcc-js/wasm-graphviz"),
    ]),
  plantuml: () => import("pako"),
  katex: () => import("katex"),
  math: () => import("katex"),
  typst: () => {
    const url = `https://esm.sh/@myriaddreamin/typst.ts@0.6.0`
    return import(/* @vite-ignore */ url)
  },
}

const FENCE_RE = /^[ \t]*`{3,}(\w+)/gm
const DIRECTIVE_RE = /^[ \t]*:{3,}\s*(\w+)/gm
const MATH_RE = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$/

/** Fire-and-forget preloads for diagram bundles detected in markdown. */
export function preloadDiagramBundles(markdown: string): void {
  const needed = new Set<string>()

  FENCE_RE.lastIndex = 0
  for (
    let m = FENCE_RE.exec(markdown);
    m !== null;
    m = FENCE_RE.exec(markdown)
  ) {
    const lang = m[1]?.toLowerCase()
    if (lang && lang in DIAGRAM_IMPORTS) needed.add(lang)
  }

  DIRECTIVE_RE.lastIndex = 0
  for (
    let m = DIRECTIVE_RE.exec(markdown);
    m !== null;
    m = DIRECTIVE_RE.exec(markdown)
  ) {
    const lang = m[1]?.toLowerCase()
    if (lang && lang in DIAGRAM_IMPORTS) needed.add(lang)
  }

  if (MATH_RE.test(markdown)) needed.add("katex")

  for (const lang of needed) {
    DIAGRAM_IMPORTS[lang]?.().catch(() => {
      // Preload failure is non-fatal — the renderer will retry on demand.
    })
  }
}
