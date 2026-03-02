import rehypeShiki from "@shikijs/rehype"
import rehypeKatex from "rehype-katex"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import { remarkAlert } from "remark-github-blockquote-alert"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { getSingletonHighlighter } from "shiki"
import type { Processor } from "unified"
import { unified } from "unified"
import type { Heading } from "./rehype-extract-headings"
import { rehypeMermaid } from "./rehype-mermaid"

export type { Heading }

export interface MarkdownResult {
  html: string
  headings: Heading[]
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
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkAlert)
      // SECURITY: remarkRehype without allowDangerousHtml strips raw HTML from
      // markdown source, preventing XSS. Do not add allowDangerousHtml without
      // also adding rehype-sanitize.
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeMermaid)
      .use(rehypeShiki, {
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        // Load grammars on demand instead of all 100+ bundled languages upfront.
        // The shiki full-bundle fallback resolver handles lazy loading.
        langs: [],
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
