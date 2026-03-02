import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"

export interface Heading {
  depth: number
  text: string
  id: string
}

/**
 * Rehype plugin that collects heading metadata from the HAST.
 * Must run after rehype-slug so `id` attributes are present.
 */
export function rehypeExtractHeadings(headings: Heading[]) {
  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const match = /^h([1-6])$/.exec(node.tagName)
      if (!match) return

      const depth = Number(match[1])
      const id = getProp(node, "id")
      const text = extractText(node)

      if (id && text) {
        headings.push({ depth, text, id })
      }
    })
  }
}

function getProp(node: Element, key: string): string {
  const val = node.properties?.[key]
  return typeof val === "string" ? val : ""
}

function extractText(node: Element): string {
  let result = ""
  for (const child of node.children) {
    if (child.type === "text") {
      result += child.value
    } else if (child.type === "element") {
      result += extractText(child)
    }
  }
  return result
}
