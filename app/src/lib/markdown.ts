import rehypeShiki from "@shikijs/rehype"
import rehypeKatex from "rehype-katex"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { type Heading, rehypeExtractHeadings } from "./rehype-extract-headings"
import { rehypeMermaid } from "./rehype-mermaid"

export type { Heading }

export interface MarkdownResult {
  html: string
  headings: Heading[]
}

export async function renderMarkdown(source: string): Promise<MarkdownResult> {
  const headings: Heading[] = []

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    // SECURITY: remarkRehype without allowDangerousHtml strips raw HTML from
    // markdown source, preventing XSS. Do not add allowDangerousHtml without
    // also adding rehype-sanitize.
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeMermaid)
    .use(rehypeShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    })
    .use(rehypeSlug)
    .use(rehypeExtractHeadings(headings))
    .use(rehypeStringify)

  const result = await processor.process(source)
  return { html: String(result), headings }
}
