import type { RefObject } from "preact"
import { useEffect, useMemo, useRef } from "preact/hooks"
import { markChanged } from "../lib/highlight"
import { langFromPath } from "../lib/lang"
import type { EditorState } from "../lib/use-editor-sync"
import { useEditorSyncState } from "../lib/use-editor-sync"
import { useShiki } from "../lib/use-shiki"

interface Props {
  path: string
  content: string
  changedLinesRef: RefObject<number[] | null>
}

/** Query .line elements once — used by both highlight and scroll. */
function getLineElements(
  container: HTMLElement,
): NodeListOf<HTMLElement> | null {
  const lineEls = container.querySelectorAll<HTMLElement>(".line")
  return lineEls.length > 0 ? lineEls : null
}

/** Apply editor cursor/selection highlights to .line elements. */
function applyEditorHighlights(
  lineEls: NodeListOf<HTMLElement>,
  container: HTMLElement,
  state: EditorState,
): void {
  const clamp = (n: number) => Math.max(0, Math.min(n - 1, lineEls.length - 1))

  // Clear previous editor highlights.
  for (const prev of container.querySelectorAll(
    ".line--cursor, .line--selected, .line--selected-first, .line--selected-last, .line--selected-only",
  )) {
    prev.classList.remove(
      "line--cursor",
      "line--selected",
      "line--selected-first",
      "line--selected-last",
      "line--selected-only",
    )
  }

  if (state.cursor && state.trigger !== "selection") {
    lineEls[clamp(state.cursor.line)]?.classList.add("line--cursor")
  }

  if (state.selection && state.trigger === "selection") {
    const start = Math.min(
      clamp(state.selection.startLine),
      clamp(state.selection.endLine),
    )
    const end = Math.max(
      clamp(state.selection.startLine),
      clamp(state.selection.endLine),
    )
    for (let i = start; i <= end; i++) {
      lineEls[i]?.classList.add("line--selected")
    }
    if (start === end) {
      lineEls[start]?.classList.add("line--selected-only")
    } else {
      lineEls[start]?.classList.add("line--selected-first")
      lineEls[end]?.classList.add("line--selected-last")
    }
  }
}

export function CodeView({ path, content, changedLinesRef }: Props) {
  const lang = langFromPath(path) ?? "text"
  const html = useShiki(content, lang)
  const containerRef = useRef<HTMLDivElement>(null)
  // Snapshot changed lines when content updates so they survive until Shiki
  // finishes. The parent ref is consumed once; this local copy persists
  // across the fallback→Shiki effect re-runs.
  const pendingRef = useRef<number[] | null>(null)

  // Hook first — refs are available before the syncRef closure reads them.
  const { editorRef, consumeScroll } = useEditorSyncState(
    path,
    containerRef,
    () => syncRef.current(),
  )

  // Imperative highlight + scroll — called from WS events (no re-render)
  // and from the Shiki effect (reapply after DOM replace).
  // biome-ignore lint/suspicious/noEmptyBlockStatements: noop placeholder, overwritten immediately below
  const syncRef = useRef(() => {})
  syncRef.current = () => {
    const el = containerRef.current
    if (!el) return
    const lineEls = getLineElements(el)
    if (!lineEls) return

    applyEditorHighlights(lineEls, el, editorRef.current)
    consumeScroll((line) => {
      const idx = Math.max(0, Math.min(line - 1, lineEls.length - 1))
      return lineEls[idx] ?? null
    })
  }

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
    if (!el) return

    // Reapply live-reload change flash.
    const changed = pendingRef.current
    if (changed) {
      const lineEls = el.querySelectorAll<HTMLElement>(".line")
      for (const i of changed) {
        const lineEl = lineEls[i]
        if (lineEl) markChanged(lineEl)
      }
    }

    // Reapply editor highlights after Shiki replaces the DOM.
    syncRef.current()
  }, [content, html])

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
