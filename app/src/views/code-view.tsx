import type { RefObject } from "preact"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { markChanged } from "../lib/highlight"
import { langFromPath } from "../lib/lang"
import { watchPrefix } from "../lib/path"
import type { EditorState } from "../lib/use-editor-sync"
import { useEditorSync } from "../lib/use-editor-sync"
import { useShiki } from "../lib/use-shiki"

interface Props {
  path: string
  content: string
  changedLinesRef: RefObject<number[] | null>
}

const USER_SCROLL_TIMEOUT = 2000

/** Apply editor cursor/selection highlights to .line elements. */
function applyEditorHighlights(
  container: HTMLElement,
  state: EditorState,
): void {
  const lineEls = container.querySelectorAll<HTMLElement>(".line")
  if (lineEls.length === 0) return

  const clamp = (n: number) => Math.max(0, Math.min(n - 1, lineEls.length - 1))

  // Clear previous editor highlights.
  for (const prev of container.querySelectorAll(
    ".line--cursor, .line--selected",
  )) {
    prev.classList.remove("line--cursor", "line--selected")
  }

  if (state.cursor) {
    lineEls[clamp(state.cursor.line)]?.classList.add("line--cursor")
  }

  if (state.selection) {
    const start = clamp(state.selection.startLine)
    const end = clamp(state.selection.endLine)
    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
      lineEls[i]?.classList.add("line--selected")
    }
  }
}

/** Scroll a 1-indexed line number into view within the code container. */
function scrollLineIntoView(
  container: HTMLElement,
  line: number,
  programmaticFlag: { current: boolean },
): void {
  const lineEls = container.querySelectorAll<HTMLElement>(".line")
  if (lineEls.length === 0) return
  const idx = Math.max(0, Math.min(line - 1, lineEls.length - 1))
  programmaticFlag.current = true
  lineEls[idx]?.scrollIntoView({ block: "nearest", behavior: "instant" })
  // Scroll events fire asynchronously (after microtasks). Use rAF to
  // keep the flag set until after the browser dispatches the scroll event.
  requestAnimationFrame(() => {
    programmaticFlag.current = false
  })
}

export function CodeView({ path, content, changedLinesRef }: Props) {
  const lang = langFromPath(path) ?? "text"
  const html = useShiki(content, lang)
  const containerRef = useRef<HTMLDivElement>(null)
  // Snapshot changed lines when content updates so they survive until Shiki
  // finishes. The parent ref is consumed once; this local copy persists
  // across the fallback→Shiki effect re-runs.
  const pendingRef = useRef<number[] | null>(null)

  // Editor sync — subscribe directly so parent doesn't re-render on every
  // editor event. State is stored in a ref; a tick counter triggers the effect.
  const editorRef = useRef<EditorState>({})
  // Line number to scroll to on the next effect run, consumed once.
  const scrollToLineRef = useRef<number | null>(null)
  const [editorTick, setEditorTick] = useState(0)
  useEditorSync(watchPrefix(path), (state) => {
    editorRef.current = state
    // Determine which line to scroll to based on the triggering event.
    switch (state.trigger) {
      case "cursor":
        scrollToLineRef.current = state.cursor?.line ?? null
        break
      case "selection":
        if (state.selection) {
          scrollToLineRef.current = Math.min(
            state.selection.startLine,
            state.selection.endLine,
          )
        }
        break
      case "scroll":
        scrollToLineRef.current = state.scroll?.line ?? null
        break
    }
    setEditorTick((n) => n + 1)
  })

  // Scroll-fight prevention: track user scroll, suppress editor scroll for 2s.
  // programmaticScrollRef prevents our own scrollIntoView from tripping the guard.
  const userScrollingRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const programmaticScrollRef = useRef(false)

  const onUserScroll = useCallback(() => {
    if (programmaticScrollRef.current) return
    userScrollingRef.current = true
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false
    }, USER_SCROLL_TIMEOUT)
  }, [])

  useEffect(() => {
    const el = containerRef.current?.closest(".file-content")
    if (!el) return
    el.addEventListener("scroll", onUserScroll, { passive: true })
    return () => el.removeEventListener("scroll", onUserScroll)
  }, [onUserScroll])

  const fallbackLines = useMemo(() => {
    const lines = content.split("\n")
    // Drop trailing empty element only if the file ends with a newline.
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    return lines
  }, [content])

  // Capture changed lines from parent when content changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: snapshot on content change only
  useEffect(() => {
    pendingRef.current = changedLinesRef.current
    changedLinesRef.current = null
  }, [content])

  // Apply highlights after every DOM update (fallback render or Shiki replace).
  // Re-runs when `html` changes so highlights survive Shiki replacing the DOM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: html triggers re-apply after Shiki DOM replace
  useEffect(() => {
    const el = containerRef.current
    const changed = pendingRef.current
    if (!el || !changed) return

    const lineEls = el.querySelectorAll<HTMLElement>(".line")
    for (const i of changed) {
      const lineEl = lineEls[i]
      if (lineEl) markChanged(lineEl)
    }
  }, [content, html])

  // Reapply editor highlights after Shiki replaces the DOM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: html triggers reapply after Shiki DOM replace
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    applyEditorHighlights(el, editorRef.current)
  }, [editorTick, html])

  // Scroll to the target line — only on real editor events, not Shiki re-renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: editorTick is the only meaningful trigger
  useEffect(() => {
    const el = containerRef.current
    const line = scrollToLineRef.current
    scrollToLineRef.current = null
    if (!el || line == null || userScrollingRef.current) return
    scrollLineIntoView(el, line, programmaticScrollRef)
  }, [editorTick])

  return html ? (
    <div
      ref={containerRef}
      class="code-view"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe (no user HTML)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <div ref={containerRef} class="code-view">
      <pre>
        <code>
          {fallbackLines.map((line) => (
            <>
              <span class="line">{line}</span>
              {"\n"}
            </>
          ))}
        </code>
      </pre>
    </div>
  )
}
