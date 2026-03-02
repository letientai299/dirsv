import morphdom from "morphdom"
import { useEffect, useRef, useState } from "preact/hooks"
import { TableOfContents } from "../components/toc"
import { Toolbar } from "../components/toolbar"
import { injectCopyButtons } from "../lib/code-copy"
import type { MarkdownResult } from "../lib/markdown"
import { renderMarkdown } from "../lib/markdown"
import { renderMermaidBlocks } from "../lib/mermaid-render"
import "github-markdown-css/github-markdown.css"
import "katex/dist/katex.min.css"
import "remark-github-blockquote-alert/alert.css"

interface Props {
  path: string
  content: string
}

export function MarkdownView({ path, content }: Props) {
  const [result, setResult] = useState<MarkdownResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const prevContentRef = useRef("")

  useEffect(() => {
    // Skip re-render if raw content is unchanged (SSE may re-fetch same file).
    if (content === prevContentRef.current) return
    prevContentRef.current = content

    // Keep old result visible — no setResult(null) flash.
    setError(null)
    let cancelled = false
    renderMarkdown(content)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [content])

  // Patch the DOM incrementally instead of replacing innerHTML wholesale.
  // morphdom diffs old ↔ new and only touches changed nodes, preserving
  // scroll position, focus, and already-rendered mermaid diagrams.
  useEffect(() => {
    const el = contentRef.current
    if (!el || !result) return

    if (el.innerHTML === "") {
      // First render — just set innerHTML directly.
      el.innerHTML = result.html
    } else {
      // Wrap new HTML in a temporary container so morphdom can diff children.
      const tmp = document.createElement("article")
      tmp.innerHTML = result.html
      morphdom(el, tmp, { childrenOnly: true })
    }

    void renderMermaidBlocks(el)
    injectCopyButtons(el)
  }, [result])

  if (error) return <div class="error">Render error: {error}</div>
  if (result === null) return <div class="loading">Rendering...</div>

  return (
    <div>
      <Toolbar path={path} />
      <div class="md-layout">
        <article ref={contentRef} class="markdown-body" />
        <TableOfContents headings={result.headings} contentRef={contentRef} />
      </div>
    </div>
  )
}
