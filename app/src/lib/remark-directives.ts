import type { Code, Paragraph, Root, Text } from "mdast"
import type {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive"
import type { Parent } from "unist"
import { SKIP, visit } from "unist-util-visit"
import type { VFile } from "vfile"

/** Languages handled by the rehype-diagram factory plugins. */
const DIAGRAM_LANGUAGES = new Set([
  "mermaid",
  "plantuml",
  "graphviz",
  "dot",
  "d2",
  "dbml",
])

/** Maps to the same HTML structure as remark-github-blockquote-alert. */
const ADMONITION_NAMES = new Set([
  "note",
  "tip",
  "warning",
  "caution",
  "important",
])

type Directive = ContainerDirective | LeafDirective | TextDirective

const DIRECTIVE_TYPES: ReadonlySet<string> = new Set([
  "containerDirective",
  "leafDirective",
  "textDirective",
])

function isDirective(type: string): boolean {
  return DIRECTIVE_TYPES.has(type)
}

function ensureData(directive: Directive) {
  if (!directive.data) directive.data = {}
  return directive.data
}

/**
 * Remark plugin that converts `:::` directive nodes (from `remark-directive`)
 * into structures the existing pipeline already handles:
 *
 * - Diagram directives → mdast `code` nodes (rehype-diagram picks them up)
 * - Admonition directives → `markdown-alert` divs (existing alert.css)
 * - Unknown directives → generic `<div>` / `<span>`
 */
export function remarkDirectivesHandler() {
  return (tree: Root, file: VFile) => {
    // `file` contains the post-normalization string (ADO `::: name` → `:::name`
    // collapsed by normalizeDirectives in markdown.ts). Position offsets from
    // remark-directive are valid against this normalized source.
    const source = String(file)

    visit(tree, (node, index, parent) => {
      if (!isDirective(node.type) || index == null || !parent) return

      const directive = node as Directive
      const name = directive.name.toLowerCase()

      if (
        directive.type === "containerDirective" &&
        DIAGRAM_LANGUAGES.has(name)
      )
        return handleDiagram(directive, name, index, parent, source)

      if (directive.type === "containerDirective" && ADMONITION_NAMES.has(name))
        return handleAdmonition(directive, name)

      handleUnknown(directive, name)
    })
  }
}

/** Convert diagram directive to a code node so rehype-diagram picks it up. */
function handleDiagram(
  directive: ContainerDirective,
  name: string,
  index: number,
  parent: Parent,
  source: string,
) {
  const raw = extractRawBody(source, directive)
  const code: Code = { type: "code", lang: name, value: raw }
  parent.children[index] = code
  return SKIP
}

/** Convert admonition to the same HTML as remark-github-blockquote-alert. */
function handleAdmonition(directive: ContainerDirective, name: string) {
  const data = ensureData(directive)
  data.hName = "div"
  data.hProperties = {
    className: `markdown-alert markdown-alert-${name}`,
    dir: "auto",
  }

  // Strip the directiveLabel child — we build our own title.
  // remark-directive sets `data.directiveLabel` on the first paragraph
  // when `:::name[label]` syntax is used.
  const children = directive.children.filter(
    (c) =>
      !(
        c.type === "paragraph" &&
        (c.data as Record<string, unknown> | undefined)?.["directiveLabel"]
      ),
  )

  const titleText: Text = {
    type: "text",
    value: name.charAt(0).toUpperCase() + name.slice(1),
  }
  const titlePara: Paragraph = {
    type: "paragraph",
    data: { hProperties: { className: "markdown-alert-title" } },
    children: [titleText],
  }

  directive.children = [titlePara, ...children]
  return SKIP
}

/** Wrap unknown directives in a generic div/span. */
function handleUnknown(directive: Directive, name: string) {
  const data = ensureData(directive)
  const isInline = directive.type === "textDirective"
  data.hName = isInline ? "span" : "div"
  data.hProperties = {
    className: `directive directive-${name}`,
  }
}

/**
 * Extract the raw body of a container directive from the original source,
 * preserving exact whitespace. Slices between the opening `:::name` line
 * and the closing `:::` line.
 */
function extractRawBody(source: string, node: ContainerDirective): string {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (start === undefined || end === undefined) return ""

  const slice = source.slice(start, end)

  // Strip opening line (:::name... possibly with attributes/label)
  const firstNewline = slice.indexOf("\n")
  if (firstNewline === -1) return ""
  const afterOpening = slice.slice(firstNewline + 1)

  // Strip closing ::: line
  const lastNewline = afterOpening.lastIndexOf("\n")
  if (lastNewline === -1) return afterOpening.trimEnd()
  return afterOpening.slice(0, lastNewline)
}
