import type { Element, ElementContent, Root } from "hast"
import { visit } from "unist-util-visit"
import { getClassList } from "./hast-utils"
import { wrapInFigure } from "./rehype-figure"

interface DiagramOpts {
  languages: string[]
  className: string
  dataAttr: string
}

/**
 * Factory that creates a rehype plugin replacing `<pre><code class="language-X">`
 * blocks with `<div class="<className> diagram-placeholder" <dataAttr>="...">`.
 * Shiki skips these; client-side rendering happens later.
 */
export function createRehypeDiagram(opts: DiagramOpts) {
  return () => (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (!parent || index === undefined || index === null) return
      const source = extractSource(node, opts.languages)
      if (source === null) return

      const placeholder: Element = {
        type: "element",
        tagName: "div",
        properties: {
          className: [opts.className, "diagram-placeholder"],
          [opts.dataAttr]: source,
        },
        children: [],
      }

      parent.children[index] = wrapInFigure(placeholder, opts.languages[0])
    })
  }
}

function extractSource(node: Element, languages: string[]): string | null {
  if (node.tagName !== "pre") return null

  const code = node.children[0]
  if (!code || code.type !== "element" || code.tagName !== "code") return null

  const classes = getClassList(code)
  if (!languages.some((lang) => classes.includes(`language-${lang}`)))
    return null

  return collectText(code.children).trim()
}

function collectText(children: ElementContent[]): string {
  let out = ""
  for (const child of children) {
    if (child.type === "text") out += child.value
  }
  return out
}
