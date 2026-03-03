import rehypeShiki from "@shikijs/rehype"
import rehypeColorChips from "rehype-color-chips"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import rehypeVideo from "rehype-video"
import remarkDefinitionList from "remark-definition-list"
import remarkEmoji from "remark-emoji"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import { remarkAlert } from "remark-github-blockquote-alert"
import remarkGithubYamlMetadata from "remark-github-yaml-metadata"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { getSingletonHighlighter } from "shiki"
import type { Processor } from "unified"
import { unified } from "unified"
import { rehypeD2 } from "./rehype-d2"
import { rehypeDbml } from "./rehype-dbml"
import type { Heading } from "./rehype-extract-headings"
import { rehypeGraphviz } from "./rehype-graphviz"
import { rehypeKatexPlaceholder } from "./rehype-katex-placeholder"
import { rehypeMermaid } from "./rehype-mermaid"
import { rehypePlantuml } from "./rehype-plantuml"
import { rehypeTypstDiagram } from "./rehype-typst-diagram"

export type { Heading }

export interface MarkdownResult {
  html: string
  headings: Heading[]
}

// Extend the default sanitize schema to allow classes/attributes produced by
// remark plugins (math, alerts, mermaid) while still blocking XSS. Plugins that
// run AFTER sanitization (katex-placeholder, Shiki) don't need allowlisting —
// their output is never seen by the sanitizer.
// Helper to pull per-element attribute defaults from the sanitize schema.
// Uses bracket access to satisfy TS noPropertyAccessFromIndexSignature, wrapped
// in a function so biome's useLiteralKeys rule doesn't trigger.
function schemaAttrs(key: string) {
  return defaultSchema.attributes?.[key] ?? []
}

const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // remark-math markers consumed by rehype-katex-placeholder after sanitization
    code: [
      ...schemaAttrs("code"),
      ["className", "math-inline", "math-display"],
    ],
    // remark-github-blockquote-alert
    div: [...schemaAttrs("div"), "dir", ["className", /^markdown-alert/]],
    p: [...schemaAttrs("p"), "dir", ["className", "markdown-alert-title"]],
    span: [...schemaAttrs("span"), "dir"],
    // SVG icons from remark-github-blockquote-alert title paragraphs
    svg: ["viewBox", "width", "height", "ariaHidden", "className"],
    path: ["d"],
    // Media elements
    video: ["controls", "width", "height", "preload", "poster"],
    audio: ["controls", "preload"],
    source: [...schemaAttrs("source"), "src", "type"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // SVG elements used by alert icons
    "svg",
    "path",
    // Media elements
    "video",
    "audio",
    // Definition list elements
    "dl",
    "dt",
    "dd",
  ],
}

// Cached processor — all plugins are stateless so the instance is reusable.
// Shiki lazy-loads themes/grammars on first .process(); subsequent calls reuse
// the cache internally.
// biome-ignore lint/suspicious/noExplicitAny: unified's generic types are deeply nested; the processor is used only via .process(string)
let cached: Processor<any, any, any, any, any> | undefined

function getProcessor() {
  if (!cached) {
    cached = unified()
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGithubYamlMetadata)
      .use(remarkGfm)
      .use(remarkDefinitionList)
      .use(remarkMath)
      .use(remarkAlert)
      .use(remarkEmoji)
      // SECURITY: allowDangerousHtml lets raw HTML through as "raw" HAST nodes.
      // rehype-raw parses them into proper elements, then rehype-sanitize strips
      // anything unsafe. This allows <kbd>, <sub>, <sup>, <details>, etc.
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeColorChips)
      .use(rehypeVideo)
      .use(rehypeSanitize, sanitizeSchema)
      .use(rehypeKatexPlaceholder)
      .use(rehypeMermaid)
      .use(rehypePlantuml)
      .use(rehypeGraphviz)
      .use(rehypeD2)
      .use(rehypeDbml)
      .use(rehypeTypstDiagram)
      .use(rehypeShiki, {
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        // Load grammars on demand instead of all 100+ bundled languages upfront.
        langs: [],
        lazy: true,
        fallbackLanguage: "text",
      })
      .use(rehypeSlug)
      .use(rehypeStringify)
  }
  return cached
}

/** Extract headings from rendered HTML via DOMParser (fast, no HAST needed). */
function extractHeadings(html: string): Heading[] {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const headings: Heading[] = []
  for (const el of doc.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const id = el.id
    const text = el.textContent?.trim() ?? ""
    if (id && text) {
      const depth = Number.parseInt(el.tagName.charAt(1), 10)
      headings.push({ depth, text, id })
    }
  }
  return headings
}

/** Eagerly load the Shiki WASM engine + themes so the first render is fast. */
export function warmUpShiki(): void {
  void getSingletonHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [],
  })
}

export async function renderMarkdown(source: string): Promise<MarkdownResult> {
  const result = await getProcessor().process(source)
  const html = String(result)
  return { html, headings: extractHeadings(html) }
}
