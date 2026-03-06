import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { JsonToolbar } from "../components/json-toolbar"
import { JsonTree } from "../components/json-tree"
import {
  collectAllPaths,
  computeFlatVisiblePaths,
  computeVisiblePaths,
  type JsonValue,
} from "../lib/json-tree"
import { useShiki } from "../lib/use-shiki"

interface Props {
  content: string
  parse: (content: string) => JsonValue
  lang: string
}

const LARGE_THRESHOLD = 500_000

export function StructuredView({ content, parse, lang }: Props) {
  const [parsed, setParsed] = useState<JsonValue | undefined>(undefined)
  const [parseError, setParseError] = useState(false)
  const [filter, setFilter] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<"tree" | "raw">("tree")
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const [largeWarned, setLargeWarned] = useState(false)
  const rawHtml = useShiki(content, lang)

  useEffect(() => {
    // Reset UI state when content changes (e.g., navigating between .json files).
    setFilter("")
    setLargeWarned(false)
    setMode("tree")

    try {
      const val = parse(content) as JsonValue
      setParsed(val)
      setParseError(false)
      // Preserve expanded paths that still exist in new data
      setExpanded((prev) => {
        if (prev.size === 0) return prev
        const newPaths = collectAllPaths(val)
        const kept = new Set<string>()
        for (const p of prev) {
          if (newPaths.has(p)) kept.add(p)
        }
        return kept
      })
    } catch {
      setParsed(undefined)
      setParseError(true)
      setMode("raw")
    }
  }, [content, parse])

  // Default to raw for large files
  useEffect(() => {
    if (content.length > LARGE_THRESHOLD && !largeWarned) {
      setMode("raw")
      setLargeWarned(true)
    }
  }, [content, largeWarned])

  const allPaths = useMemo(
    () => (parsed !== undefined ? collectAllPaths(parsed) : new Set<string>()),
    [parsed],
  )

  const visible = useMemo(
    () => computeVisiblePaths(allPaths, filter),
    [allPaths, filter],
  )

  const flatPaths = useMemo(
    () =>
      parsed !== undefined
        ? computeFlatVisiblePaths(parsed, expanded, visible)
        : [],
    [parsed, expanded, visible],
  )

  // Reset focus when content or filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on content/filter change
  useEffect(() => {
    setFocusedPath(null)
  }, [content, filter])

  const handleToggle = useCallback((nodePath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(nodePath)) next.delete(nodePath)
      else next.add(nodePath)
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    if (parsed !== undefined) setExpanded(collectAllPaths(parsed))
  }, [parsed])

  const handleCollapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const handleModeChange = useCallback(
    (m: "tree" | "raw") => {
      if (m === "tree" && content.length > LARGE_THRESHOLD && !largeWarned) {
        setLargeWarned(true)
      }
      setMode(m)
    },
    [content, largeWarned],
  )

  return (
    <div>
      <JsonToolbar
        filter={filter}
        onFilterChange={setFilter}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        mode={mode}
        onModeChange={handleModeChange}
        treeDisabled={parseError}
      />
      {content.length > LARGE_THRESHOLD && mode === "tree" && (
        <div class="jt-warning">
          Large file ({(content.length / 1024).toFixed(0)} KB) — tree view may
          be slow.
        </div>
      )}
      {mode === "tree" && parsed !== undefined ? (
        <JsonTree
          value={parsed}
          expanded={expanded}
          onToggle={handleToggle}
          filter={filter}
          allPaths={allPaths}
          focusedPath={focusedPath}
          flatPaths={flatPaths}
          onFocusPath={setFocusedPath}
        />
      ) : rawHtml ? (
        <div
          class="code-view"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe (no user HTML)
          dangerouslySetInnerHTML={{ __html: rawHtml }}
        />
      ) : (
        <pre class="code-view-fallback">
          <code>{content}</code>
        </pre>
      )}
    </div>
  )
}
