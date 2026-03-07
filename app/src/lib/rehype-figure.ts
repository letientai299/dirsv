import type { Element, Properties, Root } from "hast"
import type { Parent } from "unist"
import { visit } from "unist-util-visit"
import { getClassList } from "./hast-utils"

/**
 * Rehype plugin that wraps `<pre><code>` blocks in a `.figure-container` div,
 * making code fences tab-focusable and providing a mount point for toolbars.
 * Skips `<pre>` blocks already inside a `.figure-container` (diagram wrappers).
 */
export function rehypeFigure() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      if (node.tagName !== "pre") return

      const code = getCodeChild(node)
      if (!code) return
      if (hasClass(parent, "figure-container")) return

      parent.children[index] = wrapInFigure(node, detectLanguage(code))
    })
  }
}

export function wrapInFigure(node: Element, lang: string | undefined): Element {
  const props: Properties = {
    className: ["figure-container"],
    tabIndex: 0,
  }
  if (lang) props["data-figure-lang"] = lang

  return {
    type: "element",
    tagName: "div",
    properties: props,
    children: [node],
  }
}

function getCodeChild(node: Element): Element | null {
  const first = node.children[0]
  if (first?.type === "element" && first.tagName === "code") return first
  return null
}

function hasClass(node: Parent, name: string): boolean {
  if (node.type !== "element") return false
  return getClassList(node as Element).includes(name)
}

function detectLanguage(code: Element): string | undefined {
  for (const cls of getClassList(code)) {
    if (typeof cls === "string" && cls.startsWith("language-")) {
      return cls.slice("language-".length)
    }
  }
  return undefined
}
