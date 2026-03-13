import type { Element, Root } from "hast"
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
import type { Heading } from "./rehype-extract-headings"
import { rehypeFigure } from "./rehype-figure"
import { rehypeGraphviz } from "./rehype-graphviz"
import { rehypeKatexPlaceholder } from "./rehype-katex-placeholder"
import { rehypeMermaid } from "./rehype-mermaid"
import { rehypePlantuml } from "./rehype-plantuml"
import { rehypeSourceLine } from "./rehype-source-line"
import { remarkDirectivesHandler } from "./remark-directives"
import { remarkMdxToCode } from "./remark-mdx-to-code"
import { SHIKI_THEME_LIST, SHIKI_THEMES } from "./shiki-config"

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
    // remark-math v6 uses `language-math` which the default schema already
    // allows via /^language-/. No extra allowlist needed for math classes.
    code: [...schemaAttrs("code")],
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
      .use(remarkAlert)
      .use(remarkEmoji)
      .use(remarkDirective)
      .use(remarkDirectivesHandler)
      // SECURITY: allowDangerousHtml lets raw HTML through as "raw" HAST nodes.
      // rehype-raw parses them into proper elements, then rehype-sanitize strips
      // anything unsafe. This allows <kbd>, <sub>, <sup>, <details>, etc.
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeColorChips)
      .use(rehypeVideo)
      .use(rehypeSanitize, sanitizeSchema)
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
    .use(rehypeFigure)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings)
    .use(rehypeStringify)
}

/** Shared remark/rehype pipeline without Shiki — produces plain <pre><code>. */
let cachedBase: AnyProcessor | undefined

function getBaseProcessor(): AnyProcessor {
  if (!cachedBase) {
    cachedBase = applyFinalPlugins(applySharedPlugins(unified()))
  }
  return cachedBase
}

/** Full pipeline with Shiki — built lazily via dynamic import. */
let shikiProcessorPromise: Promise<AnyProcessor> | undefined

function getShikiProcessor(): Promise<AnyProcessor> {
  if (!shikiProcessorPromise) {
    shikiProcessorPromise = (async () => {
      const [
        { default: rehypeShiki },
        { getSingletonHighlighter },
        { rehypeShikiCachedPre, rehypeShikiCachedPost },
      ] = await Promise.all([
        import("@shikijs/rehype"),
        import("shiki"),
        import("./rehype-shiki-cached"),
      ])

      // Warm up the highlighter so the first render is fast.
      void getSingletonHighlighter({
        themes: [...SHIKI_THEME_LIST],
        langs: [],
      })

      const processor = applySharedPlugins(unified())
        .use(rehypeLangAlias)
        .use(rehypeShikiCachedPre)
        .use(rehypeShiki, {
          themes: { light: SHIKI_THEMES.light, dark: SHIKI_THEMES.dark },
          defaultColor: false,
          langs: [],
          lazy: true,
          fallbackLanguage: "text",
        })
        .use(rehypeShikiCachedPost)

      return applyFinalPlugins(processor)
    })()
  }

  return shikiProcessorPromise
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

/**
 * Normalize ADO-style `::: name` (space after colons) to `:::name` so
 * remark-directive can parse it. Only touches lines that look like a
 * directive opener — won't affect fenced code blocks or other content.
 */
const ADO_DIRECTIVE_RE = /^([ \t]*:{3,})\s+(\w)/gm

export function normalizeDirectives(source: string): string {
  if (!source.includes(":::")) return source
  return source.replace(ADO_DIRECTIVE_RE, "$1$2")
}

/** Render markdown without syntax highlighting (fast first paint). */
export async function renderMarkdown(source: string): Promise<MarkdownResult> {
  const result = await getBaseProcessor().process(normalizeDirectives(source))
  const html = String(result)
  return { html, headings: extractHeadings(html) }
}

/** Render markdown with Shiki syntax highlighting (lazy-loaded). */
export async function renderMarkdownHighlighted(
  source: string,
): Promise<MarkdownResult> {
  const processor = await getShikiProcessor()
  const result = await processor.process(normalizeDirectives(source))
  const html = String(result)
  return { html, headings: extractHeadings(html) }
}

// ---------------------------------------------------------------------------
// MDX rendering — cached like the markdown path
// ---------------------------------------------------------------------------

/** Shared MDX pipeline without Shiki. */
let cachedMdxBase: AnyProcessor | undefined

function getMdxBaseProcessor(): AnyProcessor {
  if (!cachedMdxBase) {
    cachedMdxBase = applyFinalPlugins(applyMdxPlugins(unified()))
  }
  return cachedMdxBase
}

/** Full MDX pipeline with Shiki — built lazily via dynamic import. */
let mdxShikiProcessorPromise: Promise<AnyProcessor> | undefined

function getMdxShikiProcessor(): Promise<AnyProcessor> {
  if (!mdxShikiProcessorPromise) {
    mdxShikiProcessorPromise = (async () => {
      const [
        { default: rehypeShiki },
        { getSingletonHighlighter },
        { rehypeShikiCachedPre, rehypeShikiCachedPost },
      ] = await Promise.all([
        import("@shikijs/rehype"),
        import("shiki"),
        import("./rehype-shiki-cached"),
      ])

      void getSingletonHighlighter({
        themes: [...SHIKI_THEME_LIST],
        langs: [],
      })

      const processor = applyMdxPlugins(unified())
        .use(rehypeLangAlias)
        .use(rehypeShikiCachedPre)
        .use(rehypeShiki, {
          themes: { light: SHIKI_THEMES.light, dark: SHIKI_THEMES.dark },
          defaultColor: false,
          langs: [],
          lazy: true,
          fallbackLanguage: "text",
        })
        .use(rehypeShikiCachedPost)

      return applyFinalPlugins(processor)
    })()
  }

  return mdxShikiProcessorPromise
}

/** Render MDX without syntax highlighting. */
export async function renderMdx(source: string): Promise<MarkdownResult> {
  const result = await getMdxBaseProcessor().process(
    normalizeDirectives(source),
  )
  const html = String(result)
  return { html, headings: extractHeadings(html) }
}

/** Render MDX with Shiki syntax highlighting (lazy-loaded). */
export async function renderMdxHighlighted(
  source: string,
): Promise<MarkdownResult> {
  const processor = await getMdxShikiProcessor()
  const result = await processor.process(normalizeDirectives(source))
  const html = String(result)
  return { html, headings: extractHeadings(html) }
}
