import type { Element, ElementContent, Root } from "hast"
import { visit } from "unist-util-visit"

/**
 * Rehype plugin that replaces `<pre><code class="language-graphviz">` and
 * `<pre><code class="language-dot">` blocks with
 * `<div class="graphviz-placeholder" data-graphviz="...">` so Shiki
 * doesn't try to highlight them. Client-side rendering happens later.
 */
export function rehypeGraphviz() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      const source = extractGraphvizSource(node)
      if (source === null) return

      const placeholder: Element = {
        type: "element",
        tagName: "div",
        properties: {
          className: ["graphviz-placeholder"],
          "data-graphviz": source,
        },
        children: [],
      }

      parent.children[index] = placeholder
    })
  }
}

/** Returns trimmed Graphviz source if `node` is `<pre><code class="language-graphviz|dot">`, else null. */
function extractGraphvizSource(node: Element): string | null {
  if (node.tagName !== "pre") return null

  const code = node.children[0]
  if (!code || code.type !== "element" || code.tagName !== "code") return null

  const classes = getClassList(code)
  if (
    !classes.includes("language-graphviz") &&
    !classes.includes("language-dot")
  )
    return null

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
