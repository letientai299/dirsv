import type { Element, ElementContent, Parent, Root } from "hast"
import { visit } from "unist-util-visit"

/**
 * Rehype plugin that replaces math nodes (from remark-math) with lightweight
 * placeholders for client-side KaTeX rendering. Moves KaTeX out of the unified
 * pipeline so it doesn't block initial HTML generation.
 *
 * Input from remark-math:
 * - Inline:  `<code class="math-inline">tex</code>`
 * - Display: `<pre><code class="math-display">tex</code></pre>`
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
  // Case 1: <pre><code class="math-display">...</code></pre>
  if (node.tagName === "pre") {
    const code = node.children[0]
    if (
      !code ||
      code.type !== "element" ||
      code.tagName !== "code" ||
      !hasClass(code, "math-display")
    )
      return null
    return makePlaceholder(collectText(code.children).trim(), true)
  }

  // Case 2: standalone <code class="math-inline|math-display">
  if (node.tagName !== "code") return null
  const isDisplay = hasClass(node, "math-display")
  const isInline = hasClass(node, "math-inline")
  if (!isDisplay && !isInline) return null

  // Skip if inside <pre> (handled by Case 1)
  if (parent.type === "element" && (parent as Element).tagName === "pre")
    return null

  return makePlaceholder(collectText(node.children).trim(), isDisplay)
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

function hasClass(node: Element, cls: string): boolean {
  const val = node.properties?.["className"]
  return Array.isArray(val) ? val.includes(cls) : false
}

function collectText(children: ElementContent[]): string {
  let out = ""
  for (const child of children) {
    if (child.type === "text") out += child.value
  }
  return out
}
