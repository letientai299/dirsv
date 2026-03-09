/**
 * Rehype plugin that prepends an anchor link to each heading element that has
 * an `id` attribute (set by rehype-slug). Produces the HTML structure expected
 * by github-markdown-css:
 *
 *   <h2 id="foo">
 *     <a class="anchor" href="#foo"><span class="octicon-link"></span></a>
 *     Heading text
 *   </h2>
 */
import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"

const HEADING_RE = /^h[1-6]$/

export function rehypeAutolinkHeadings() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!HEADING_RE.test(node.tagName)) return
      const id = node.properties?.["id"]
      if (typeof id !== "string" || !id) return

      const anchor: Element = {
        type: "element",
        tagName: "a",
        properties: { className: ["anchor"], href: `#${id}` },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["octicon-link"] },
            children: [],
          },
        ],
      }

      node.children.unshift(anchor)
    })
  }
}
