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

  useEffect(() => {
    setResult(null)
    setError(null)
    renderMarkdown(content)
      .then(setResult)
      .catch((err: Error) => setError(err.message))
  }, [content])

  // Post-render: mermaid diagrams + copy buttons
  useEffect(() => {
    const el = contentRef.current
    if (!el || !result) return
    void renderMermaidBlocks(el)
    injectCopyButtons(el)
  }, [result])

  if (error) return <div class="error">Render error: {error}</div>
  if (result === null) return <div class="loading">Rendering...</div>

  return (
    <div>
      <Toolbar path={path} />
      <div class="md-layout">
        <article
          ref={contentRef}
          class="markdown-body"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by remarkRehype (no allowDangerousHtml)
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
        <TableOfContents headings={result.headings} contentRef={contentRef} />
      </div>
    </div>
  )
}
