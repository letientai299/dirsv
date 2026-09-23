import type { Element, Root } from "hast"
import type { Root as MdRoot } from "mdast"
import rehypeColorChips from "rehype-color-chips"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import rehypeVideo from "rehype-video"
import remarkDefinitionList from "remark-definition-list"
import remarkDirective from "remark-directive"
import remarkEmoji from "remark-emoji"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import { remarkAlert } from "remark-github-blockquote-alert"
import remarkGithubYamlMetadata from "remark-github-yaml-metadata"
import remarkMath from "remark-math"
import remarkMdx from "remark-mdx"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import type { Processor } from "unified"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { langAlias } from "./lang"
import { rehypeAutolinkHeadings } from "./rehype-autolink-headings"
import { rehypeD2 } from "./rehype-d2"
import { rehypeDbml } from "./rehype-dbml"
import { type Heading, rehypeExtractHeadings } from "./rehype-extract-headings"
import { rehypeFigure } from "./rehype-figure"
import { rehypeGraphviz } from "./rehype-graphviz"
import { rehypeKatexPlaceholder } from "./rehype-katex-placeholder"
import {
  codeMetaTransformer,
  rehypeLineNumbers,
  rehypeStashCodeMeta,
} from "./rehype-line-numbers"
import { rehypeMermaid } from "./rehype-mermaid"
import { rehypePlantuml } from "./rehype-plantuml"
import { rehypeSourceLine } from "./rehype-source-line"
import { remarkDirectivesHandler } from "./remark-directives"
import { remarkMdxToCode } from "./remark-mdx-to-code"
import { SHIKI_THEMES } from "./shiki-config"

export type { Heading }

export interface MarkdownResult {
  html: string
  headings: Heading[]
  needsHighlight: boolean
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
    // remark-math v6 uses `language-math` which the default schema already
    // allows via /^language-/. No extra allowlist needed for math classes.
    code: [...schemaAttrs("code"), "dataCodeMeta"],
    // remark-github-blockquote-alert
    div: [
      ...schemaAttrs("div"),
      "dir",
      ["className", /^markdown-alert/, /^directive/],
    ],
    p: [...schemaAttrs("p"), "dir", ["className", "markdown-alert-title"]],
    span: [...schemaAttrs("span"), "dir", ["className", /^directive/]],
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

// biome-ignore lint/suspicious/noExplicitAny: unified's generic types are deeply nested; the processor is used only via .process(string)
type AnyProcessor = Processor<any, any, any, any, any>

/** Apply the shared remark (post-parse) + rehype stages (→ sanitize → diagrams). */
function applyPostParsePlugins(processor: AnyProcessor): AnyProcessor {
  return (
    processor
      .use(remarkFrontmatter)
      .use(remarkGithubYamlMetadata)
      .use(remarkGfm)
      .use(remarkDefinitionList)
      .use(remarkMath)
      .use(remarkInlineAlerts)
      .use(remarkAlert)
      .use(remarkEmoji)
      .use(remarkDirective)
      .use(remarkDirectivesHandler)
      // SECURITY: allowDangerousHtml lets raw HTML through as "raw" HAST nodes.
      // rehype-raw parses them into proper elements, then rehype-sanitize strips
      // anything unsafe. This allows <kbd>, <sub>, <sup>, <details>, etc.
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStashCodeMeta)
      .use(rehypeRaw)
      .use(rehypeColorChips)
      .use(rehypeVideo)
      .use(rehypeSanitize, sanitizeSchema)
      .use(rehypeLineNumbers)
      .use(rehypeSourceLine)
      .use(rehypeKatexPlaceholder)
      .use(rehypeMermaid)
      .use(rehypePlantuml)
      .use(rehypeGraphviz)
      .use(rehypeD2)
      .use(rehypeDbml)
  )
}

/** Markdown parse + shared pipeline. */
function applySharedPlugins(processor: AnyProcessor): AnyProcessor {
  return applyPostParsePlugins(processor.use(remarkParse))
}

/** MDX parse + shared pipeline. */
function applyMdxPlugins(processor: AnyProcessor): AnyProcessor {
  return applyPostParsePlugins(
    processor.use(remarkParse).use(remarkMdx).use(remarkMdxToCode),
  )
}

/** Rewrite aliased language classes on a single `<code>` element. */
function rewriteLangClass(node: Element): void {
  if (node.tagName !== "code") return
  const classes = node.properties?.["className"]
  if (!Array.isArray(classes)) return
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i] as string
    if (!cls.startsWith("language-")) continue
    const mapped = langAlias[cls.slice("language-".length)]
    if (mapped) classes[i] = `language-${mapped}`
  }
}

/**
 * Rewrite fenced-block language classes using {@link langAlias} so Shiki
 * can resolve them with its built-in grammars.  Runs before Shiki.
 */
function rehypeLangAlias() {
  return (tree: Root) => {
    visit(tree, "element", rewriteLangClass)
  }
}

/** Apply the final stages after code highlighting (figure, slug, stringify). */
function applyFinalPlugins(processor: AnyProcessor): AnyProcessor {
  return processor
    .use(rehypeHighlightNeeded)
    .use(rehypeFigure)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings)
    .use(rehypeExtractHeadings)
    .use(rehypeStringify)
}

function rehypeHighlightNeeded() {
  return (tree: Root, file: { data: Record<string, unknown> }) => {
    let needed = false
    visit(tree, "element", (node, _index, parent) => {
      if (
        node.tagName === "code" &&
        parent?.type === "element" &&
        parent.tagName === "pre"
      )
        needed = true
    })
    file.data["needsHighlight"] = needed
  }
}

type Format = "markdown" | "mdx"
const builders = { markdown: applySharedPlugins, mdx: applyMdxPlugins }
const baseProcessors = new Map<Format, AnyProcessor>()
const highlightedProcessors = new Map<Format, Promise<AnyProcessor>>()

function getBaseProcessor(format: Format): AnyProcessor {
  let processor = baseProcessors.get(format)
  if (!processor) {
    processor = applyFinalPlugins(builders[format](unified()))
    baseProcessors.set(format, processor)
  }
  return processor
}

function getShikiProcessor(format: Format): Promise<AnyProcessor> {
  let pending = highlightedProcessors.get(format)
  if (!pending) {
    pending = buildHighlighted(format).catch((error: unknown) => {
      highlightedProcessors.delete(format)
      throw error
    })
    highlightedProcessors.set(format, pending)
  }
  return pending
}

async function buildHighlighted(format: Format): Promise<AnyProcessor> {
  const [
    { default: rehypeShiki },
    { rehypeShikiCachedPre, rehypeShikiCachedPost },
  ] = await Promise.all([
    import("@shikijs/rehype"),
    import("./rehype-shiki-cached"),
  ])
  return applyFinalPlugins(
    builders[format](unified())
      .use(rehypeLangAlias)
      .use(rehypeShikiCachedPre)
      .use(rehypeShiki, {
        themes: { light: SHIKI_THEMES.light, dark: SHIKI_THEMES.dark },
        defaultColor: false,
        langs: [],
        lazy: true,
        fallbackLanguage: "text",
        transformers: [codeMetaTransformer],
      })
      .use(rehypeShikiCachedPost),
  )
}

// Preserve positions while retaining inline alert text.
function remarkInlineAlerts() {
  return (tree: MdRoot) => {
    visit(tree, "blockquote", (node) => {
      const paragraph = node.children[0]
      const first =
        paragraph?.type === "paragraph" ? paragraph.children[0] : undefined
      if (first?.type === "text") {
        first.value = first.value.replace(
          /^(\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])[ \t]+/i,
          "$1\n",
        )
      }
    })
  }
}

const directiveParser = unified().use(remarkParse)

export function normalizeDirectives(source: string): string {
  if (!source.includes(":::")) return source
  const protectedLines = new Set<number>()
  visit(directiveParser.parse(source), (node) => {
    if (node.type !== "code" && node.type !== "html") return
    if (!node.position) return
    for (
      let line = node.position.start.line;
      line <= node.position.end.line;
      line++
    )
      protectedLines.add(line)
  })
  return source
    .split("\n")
    .map((line, index) =>
      protectedLines.has(index + 1)
        ? line
        : line.replace(/^([ \t]*:{3,})[ \t]+(\w)/, "$1$2"),
    )
    .join("\n")
}

async function renderWith(
  processor: AnyProcessor,
  source: string,
): Promise<MarkdownResult> {
  const result = await processor.process(normalizeDirectives(source))
  return {
    html: String(result),
    headings: (result.data["headings"] as Heading[] | undefined) ?? [],
    needsHighlight: result.data["needsHighlight"] === true,
  }
}

export function renderMarkdown(source: string): Promise<MarkdownResult> {
  return renderWith(getBaseProcessor("markdown"), source)
}

export async function renderMarkdownHighlighted(
  source: string,
): Promise<MarkdownResult> {
  return renderWith(await getShikiProcessor("markdown"), source)
}

export function renderMdx(source: string): Promise<MarkdownResult> {
  return renderWith(getBaseProcessor("mdx"), source)
}

export async function renderMdxHighlighted(
  source: string,
): Promise<MarkdownResult> {
  return renderWith(await getShikiProcessor("mdx"), source)
}
