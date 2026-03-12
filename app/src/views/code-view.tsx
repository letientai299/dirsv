import type { RefObject } from "preact"
import { useEffect, useMemo, useRef } from "preact/hooks"
import { markChanged } from "../lib/highlight"
import { langFromPath } from "../lib/lang"
import { useShiki } from "../lib/use-shiki"

interface Props {
  path: string
  content: string
  changedLinesRef: RefObject<number[] | null>
}

export function CodeView({ path, content, changedLinesRef }: Props) {
  const lang = langFromPath(path) ?? "text"
  const html = useShiki(content, lang)
  const containerRef = useRef<HTMLDivElement>(null)
  // Snapshot changed lines when content updates so they survive until Shiki
  // finishes. The parent ref is consumed once; this local copy persists
  // across the fallback→Shiki effect re-runs.
  const pendingRef = useRef<number[] | null>(null)

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
