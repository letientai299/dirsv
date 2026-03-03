import type { Element, ElementContent, Parent, Root } from "hast"
import { visit } from "unist-util-visit"

/**
 * Rehype plugin that replaces math nodes (from remark-math) with lightweight
 * placeholders for client-side KaTeX rendering. Moves KaTeX out of the unified
 * pipeline so it doesn't block initial HTML generation.
 *
 * remark-math v6 produces:
 * - Inline:  `<code class="language-math math-inline">tex</code>`
 * - Display: `<pre><code class="language-math math-display">tex</code></pre>`
 *
 * After rehype-sanitize, only `language-math` may survive (the default schema
 * allows `/^language-/`). We detect math nodes via `language-math` and infer
 * display mode from context (`<pre>` wrapper = display).
 */
export function rehypeKatexPlaceholder() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      const replacement = toPlaceholder(node, parent)
      if (replacement) parent.children[index] = replacement
    })
  }
}

/** Try to convert a math node to a placeholder. Returns null if not math. */
function toPlaceholder(node: Element, parent: Parent): Element | null {
  // Case 1: <pre><code class="language-math">...</code></pre> (display)
  if (node.tagName === "pre") {
    const code = node.children[0]
    if (
      !code ||
      code.type !== "element" ||
      code.tagName !== "code" ||
      !isMathCode(code)
    )
      return null
    return makePlaceholder(collectText(code.children).trim(), true)
  }

  // Case 2: standalone <code class="language-math"> (inline)
  if (node.tagName !== "code" || !isMathCode(node)) return null

  // Skip if inside <pre> (handled by Case 1)
  if (parent.type === "element" && (parent as Element).tagName === "pre")
    return null

  return makePlaceholder(collectText(node.children).trim(), false)
}

function makePlaceholder(tex: string, display: boolean): Element {
  return {
    type: "element",
    tagName: display ? "div" : "span",
    properties: {
      className: ["katex-placeholder"],
      "data-katex": tex,
      "data-display": display ? "true" : "false",
    },
    children: [],
  }
}

/** Check if a code element is a math node (remark-math v6: `language-math`). */
function isMathCode(node: Element): boolean {
  const val = node.properties?.["className"]
  if (!Array.isArray(val)) return false
  return (
    val.includes("language-math") ||
    val.includes("math-inline") ||
    val.includes("math-display")
  )
}

function collectText(children: ElementContent[]): string {
  let out = ""
  for (const child of children) {
    if (child.type === "text") out += child.value
  }
  return out
}
