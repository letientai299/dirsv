import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"

/** Annotate HAST elements with data-source-line from their parsed position. */
export function rehypeSourceLine() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const line = node.position?.start?.line
      if (line != null) {
        node.properties ??= {}
        node.properties["dataSourceLine"] = line
      }
    })
  }
}
