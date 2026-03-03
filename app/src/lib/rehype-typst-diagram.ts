import type { Element, ElementContent, Root } from "hast"
import { visit } from "unist-util-visit"

/**
 * Rehype plugin that replaces `<pre><code class="language-typst">` blocks
 * with `<div class="typst-placeholder" data-typst="...">` so Shiki
 * doesn't try to highlight them. Client-side rendering happens later.
 *
 * Named rehypeTypstDiagram to avoid collision with rehype-katex's typst math support.
 */
export function rehypeTypstDiagram() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      const source = extractTypstSource(node)
      if (source === null) return

      const placeholder: Element = {
        type: "element",
        tagName: "div",
        properties: {
          className: ["typst-placeholder"],
          "data-typst": source,
        },
        children: [],
      }

      parent.children[index] = placeholder
    })
  }
}

/** Returns trimmed Typst source if `node` is `<pre><code class="language-typst">`, else null. */
function extractTypstSource(node: Element): string | null {
  if (node.tagName !== "pre") return null

  const code = node.children[0]
  if (!code || code.type !== "element" || code.tagName !== "code") return null

  const classes = getClassList(code)
  if (!classes.includes("language-typst")) return null

  return collectText(code.children).trim()
}

function getClassList(node: Element): string[] {
  const key = "className"
  const val = node.properties?.[key]
  return Array.isArray(val) ? (val as string[]) : []
}

function collectText(children: ElementContent[]): string {
  let out = ""
  for (const child of children) {
    if (child.type === "text") out += child.value
  }
  return out
}
