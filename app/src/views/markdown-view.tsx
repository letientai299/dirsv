import morphdom from "morphdom"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { TableOfContents } from "../components/toc"
import { renderD2Blocks } from "../lib/d2-render"
import { renderDbmlBlocks } from "../lib/dbml-render"
import { injectFigureToolbars } from "../lib/figure-toolbar"
import { renderGraphvizBlocks } from "../lib/graphviz-render"
import { renderKatexBlocks } from "../lib/katex-render"
import type { MarkdownResult } from "../lib/markdown"
import { renderMarkdown, renderMarkdownHighlighted } from "../lib/markdown"
import { handleRelativeLinkClick, rewriteMediaSrc } from "../lib/markdown-urls"
import { renderMermaidBlocks } from "../lib/mermaid-render"
import { renderPlantumlBlocks } from "../lib/plantuml-render"
import { preloadDiagramBundles } from "../lib/preload-diagrams"
import { renderTypstBlocks } from "../lib/typst-render"
import "github-markdown-css/github-markdown.css"
import "katex/dist/katex.min.css"
import "remark-github-blockquote-alert/alert.css"

interface Props {
  path: string
  content: string
}

export function MarkdownView({ content, path }: Props) {
  const [result, setResult] = useState<MarkdownResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const prevContentRef = useRef("")
  const prevPathRef = useRef("")

  useEffect(() => {
    // Skip re-render if both path and content are unchanged (WS may re-fetch same file).
    if (content === prevContentRef.current && path === prevPathRef.current)
      return
    prevContentRef.current = content
    prevPathRef.current = path

    preloadDiagramBundles(content)

    // Keep old result visible — no setResult(null) flash.
    setError(null)
    let cancelled = false
    let highlighted = false

    // First pass: render without syntax highlighting for fast initial paint.
    renderMarkdown(content)
      .then((r) => {
        if (!cancelled && !highlighted) setResult(r)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    // Second pass: re-render with Shiki highlighting. morphdom patches only
    // the changed <pre> blocks — headings, text, diagrams stay untouched.
    renderMarkdownHighlighted(content)
      .then((r) => {
        if (!cancelled) {
          highlighted = true
          setResult(r)
        }
      })
      .catch(() => {
        // Shiki enhancement failed — keep the plain render.
      })

    return () => {
      cancelled = true
    }
  }, [content, path])

  // Update page title with the first h1 heading when available.
  useEffect(() => {
    if (!result) return
    const h1 = result.headings.find((h) => h.depth === 1)
    document.title = h1 ? `${h1.text} - ${path}` : path
  }, [result, path])

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

    rewriteMediaSrc(el, path)
    void renderKatexBlocks(el)
    void renderMermaidBlocks(el)
    renderPlantumlBlocks(el)
    void renderGraphvizBlocks(el)
    void renderD2Blocks(el)
    void renderDbmlBlocks(el)
    void renderTypstBlocks(el)
    injectFigureToolbars(el)
  }, [result, path])

  // Re-render mermaid diagrams when the user toggles the colour scheme.
  // Mermaid has built-in dark/default themes. Graphviz and PlantUML use
  // explicit colours from the source — they're theme-agnostic.
  const onLinkClick = useCallback(
    (e: MouseEvent) => handleRelativeLinkClick(e, path),
    [path],
  )

  // Enter on a focused <a> fires a click event in browsers, so onClick covers
  // keyboard nav. This handler satisfies the a11y lint rule (useKeyWithClickEvents).
  const onLinkKeyDown = useCallback(() => {
    // Handled by the browser's native click dispatch on Enter.
  }, [])

  const reRenderDiagrams = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    for (const rendered of el.querySelectorAll<HTMLElement>(
      ".mermaid-rendered",
    )) {
      rendered.classList.remove("mermaid-rendered", "diagram-rendered")
      delete rendered.dataset["mermaidHash"]
    }
    for (const rendered of el.querySelectorAll<HTMLElement>(".d2-rendered")) {
      rendered.classList.remove("d2-rendered", "diagram-rendered")
      delete rendered.dataset["d2Hash"]
    }
    void renderMermaidBlocks(el)
    void renderD2Blocks(el)
  }, [])

  useEffect(() => {
    window.addEventListener("theme-change", reRenderDiagrams)
    return () => window.removeEventListener("theme-change", reRenderDiagrams)
  }, [reRenderDiagrams])

  const tocHeadings = useMemo(
    () => result?.headings.filter((h) => h.depth > 1) ?? [],
    [result],
  )

  if (error) return <div class="error">Render error: {error}</div>
  if (result === null) return <div class="loading">Rendering...</div>

  return (
    <div class="md-layout">
      <article
        ref={contentRef}
        class="markdown-body"
        onClick={onLinkClick}
        onKeyDown={onLinkKeyDown}
      />
      <TableOfContents headings={tocHeadings} contentRef={contentRef} />
    </div>
  )
}
