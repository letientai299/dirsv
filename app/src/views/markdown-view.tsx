import morphdom from "morphdom"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { FocusOverlay } from "../components/focus-overlay"
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
import type { FocusItem } from "../lib/use-focus-overlay"
import { useFocusOverlay } from "../lib/use-focus-overlay"
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
  const focus = useFocusOverlay()

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

  const renderingRef = useRef(false)

  const reRenderDiagrams = useCallback(async () => {
    if (renderingRef.current) return
    renderingRef.current = true
    const el = contentRef.current
    if (!el) {
      renderingRef.current = false
      return
    }
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
    await Promise.all([renderMermaidBlocks(el), renderD2Blocks(el)])
    renderingRef.current = false
    // updateItems is a no-op when overlay is closed (state null → null).
    const { items } = collectFocusItems(el)
    focus.updateItems(items)
  }, [focus])

  useEffect(() => {
    const onThemeChange = () => void reRenderDiagrams()
    window.addEventListener("theme-change", onThemeChange)
    return () => window.removeEventListener("theme-change", onThemeChange)
  }, [reRenderDiagrams])

  const tocHeadings = useMemo(
    () => result?.headings.filter((h) => h.depth > 1) ?? [],
    [result],
  )

  // Open focus overlay for a given DOM element inside the article.
  const openFocusFor = useCallback(
    (target: HTMLElement) => {
      const el = contentRef.current
      if (!el) return
      const { items, index } = collectFocusItems(el, target)
      if (items.length > 0) focus.open(items, index)
    },
    [focus],
  )

  // Event delegation: dblclick on images/videos/diagrams opens focus mode.
  // Works regardless of when elements appear in the DOM (async diagram renders).
  const onDblClick = useCallback(
    (e: MouseEvent) => {
      const target = findFocusTarget(e.target as HTMLElement)
      if (!target) return
      e.preventDefault()
      openFocusFor(target)
    },
    [openFocusFor],
  )

  // Enter key on focused images / .figure-container wrappers opens focus mode.
  const onContentKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter") return
      const el = e.target as HTMLElement
      if (el.tagName === "IMG") {
        e.preventDefault()
        openFocusFor(el)
        return
      }
      if (el.classList.contains("figure-container")) {
        const diagram = el.querySelector<HTMLElement>(".diagram-rendered")
        if (diagram) {
          e.preventDefault()
          openFocusFor(diagram)
        }
      }
    },
    [openFocusFor],
  )

  // Listen for "focus-expand" custom events from the figure toolbar expand button.
  const onFocusExpand = useCallback(
    (e: Event) => {
      const target = (e as CustomEvent).detail?.element as
        | HTMLElement
        | undefined
      if (target) openFocusFor(target)
    },
    [openFocusFor],
  )

  // Attach focus-expand listener. Depends on `result` so it re-runs after the
  // article mounts (result null → loading div, result set → article exists).
  // biome-ignore lint/correctness/useExhaustiveDependencies: result triggers re-attach when article mounts
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.addEventListener("focus-expand", onFocusExpand)
    return () => el.removeEventListener("focus-expand", onFocusExpand)
  }, [result, onFocusExpand])

  if (error) return <div class="error">Render error: {error}</div>
  if (result === null) return <div class="loading">Rendering...</div>

  return (
    <div class="md-layout">
      <article
        ref={contentRef}
        class="markdown-body"
        onClick={onLinkClick}
        onDblClick={onDblClick}
        onKeyDown={onContentKeyDown}
      />
      <TableOfContents headings={tocHeadings} contentRef={contentRef} />
      {focus.overlayProps && <FocusOverlay {...focus.overlayProps} />}
    </div>
  )
}

function elementToFocusItem(el: HTMLElement): FocusItem | null {
  if (el.tagName === "IMG") {
    const img = el as HTMLImageElement
    return { type: "image", src: img.src, alt: img.alt || "" }
  }
  if (el.tagName === "VIDEO") {
    const video = el as HTMLVideoElement
    return { type: "video", src: video.src }
  }
  if (el.classList.contains("diagram-rendered")) {
    const svg = el.querySelector("svg")
    return svg ? { type: "diagram", svg: svg.outerHTML } : null
  }
  return null
}

/** Collect all graphical content elements from the article in DOM order. */
function collectFocusItems(
  container: HTMLElement,
  target?: HTMLElement,
): { items: FocusItem[]; index: number } {
  const items: FocusItem[] = []
  let index = 0

  for (const el of container.querySelectorAll<HTMLElement>(
    "img, video, .diagram-rendered",
  )) {
    const item = elementToFocusItem(el)
    if (!item) continue
    if (
      target &&
      (el === target || el.contains(target) || target.contains(el))
    ) {
      index = items.length
    }
    items.push(item)
  }

  return { items, index }
}

/** Walk up from the event target to find a focusable graphical element. */
function findFocusTarget(el: HTMLElement | null): HTMLElement | null {
  while (el) {
    if (el.tagName === "IMG" || el.tagName === "VIDEO") return el
    if (el.classList.contains("diagram-rendered")) return el
    if (el.classList.contains("markdown-body")) return null
    el = el.parentElement
  }
  return null
}
