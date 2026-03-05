import type { JSX } from "preact"
import { lazy, Suspense } from "preact/compat"
import { useCallback, useMemo, useRef, useState } from "preact/hooks"
import { parse as parseYaml } from "yaml"
import { AppFooter } from "../components/app-footer"
import { Toolbar } from "../components/toolbar"
import { fetchRaw, type RawResult } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { formatSize } from "../lib/format"
import { ChevronLeft, ChevronRight } from "../lib/icons"
import { imageRe, videoRe } from "../lib/media-types"
import { navigate } from "../lib/navigate"
import { parentOfFile } from "../lib/path"
import { useAbortEffect } from "../lib/use-abort-effect"
import { useKeys } from "../lib/use-keys"
import { useSiblings } from "../lib/use-siblings"
import { useWS } from "../lib/use-ws"

const D2View = lazy(() =>
  import("./d2-view").then((m) => ({ default: m.D2View })),
)
const DbmlView = lazy(() =>
  import("./dbml-view").then((m) => ({ default: m.DbmlView })),
)
const GraphvizView = lazy(() =>
  import("./graphviz-view").then((m) => ({ default: m.GraphvizView })),
)
const HtmlView = lazy(() =>
  import("./html-view").then((m) => ({ default: m.HtmlView })),
)
const MediaView = lazy(() =>
  import("./media-view").then((m) => ({ default: m.MediaView })),
)
const TypstView = lazy(() =>
  import("./typst-view").then((m) => ({ default: m.TypstView })),
)
const MarkdownView = lazy(() =>
  import("./markdown-view").then((m) => ({ default: m.MarkdownView })),
)
const CodeView = lazy(() =>
  import("./code-view").then((m) => ({ default: m.CodeView })),
)
const CastView = lazy(() =>
  import("./cast-view").then((m) => ({ default: m.CastView })),
)
const StructuredView = lazy(() =>
  import("./structured-view").then((m) => ({ default: m.StructuredView })),
)

interface Props {
  path: string
}

const fallback = <div class="loading">Loading...</div>

function renderFileContent(
  path: string,
  result: RawResult | null,
  error: string | null,
): JSX.Element {
  if (/\.html?$/i.test(path))
    return (
      <Suspense fallback={fallback}>
        <HtmlView path={path} />
      </Suspense>
    )
  if (imageRe.test(path))
    return (
      <Suspense fallback={fallback}>
        <MediaView path={path} kind="image" />
      </Suspense>
    )
  if (videoRe.test(path))
    return (
      <Suspense fallback={fallback}>
        <MediaView path={path} kind="video" />
      </Suspense>
    )
  if (error) return <div class="error">Error: {error}</div>
  if (result === null) return fallback
  if (result.kind === "binary") {
    return (
      <div class="file-binary">
        <p>
          Binary file ({result.contentType}, {formatSize(result.size)})
        </p>
        <a href={`/api/raw${path}`} class="file-binary-open" target="_blank">
          Open in app
        </a>
      </div>
    )
  }
  if (/\.cast$/i.test(path))
    return (
      <Suspense fallback={fallback}>
        <CastView content={result.content} />
      </Suspense>
    )
  if (/\.mdx?$/i.test(path)) {
    return (
      <Suspense fallback={fallback}>
        <MarkdownView path={path} content={result.content} />
      </Suspense>
    )
  }
  if (/\.(gv|dot)$/i.test(path))
    return (
      <Suspense fallback={fallback}>
        <GraphvizView content={result.content} />
      </Suspense>
    )
  if (/\.d2$/i.test(path))
    return (
      <Suspense fallback={fallback}>
        <D2View content={result.content} />
      </Suspense>
    )
  if (/\.dbml$/i.test(path))
    return (
      <Suspense fallback={fallback}>
        <DbmlView content={result.content} />
      </Suspense>
    )
  if (/\.typ$/i.test(path))
    return (
      <Suspense fallback={fallback}>
        <TypstView content={result.content} />
      </Suspense>
    )
  if (/\.json$/i.test(path)) {
    return (
      <Suspense fallback={fallback}>
        <StructuredView
          content={result.content}
          parse={JSON.parse}
          lang="json"
        />
      </Suspense>
    )
  }
  if (/\.ya?ml$/i.test(path)) {
    return (
      <Suspense fallback={fallback}>
        <StructuredView
          content={result.content}
          parse={parseYaml}
          lang="yaml"
        />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={fallback}>
      <CodeView path={path} content={result.content} />
    </Suspense>
  )
}

const SIDEBAR_WIDTH_KEY = "dirsv-sidebar-width"
const SIDEBAR_DEFAULT = 220
const SIDEBAR_MIN = 140
const SIDEBAR_MAX = 400

function readSavedWidth(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (v) {
      const n = Number(v)
      if (n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n
    }
  } catch {
    // localStorage may be unavailable
  }
  return SIDEBAR_DEFAULT
}

export function FileView({ path }: Props) {
  const isHtml = /\.html?$/i.test(path)
  const isImage = imageRe.test(path)
  const isVideo = videoRe.test(path)

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(readSavedWidth)
  const widthRef = useRef(sidebarWidth)
  const dragging = useRef(false)

  const onHandleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX))
      widthRef.current = next
      setSidebarWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current))
      } catch {
        // localStorage may be unavailable
      }
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [])
  // Pair result with the path it belongs to so stale content can be shown
  // dimmed while the next file loads, avoiding a flash to "Loading...".
  const [loaded, setLoaded] = useState<{
    path: string
    result: RawResult
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const parentDir = useMemo(() => parentOfFile(path), [path])
  const siblings = useSiblings(parentDir)

  // Navigate to parent on h / Backspace / Alt+Up
  useKeys(
    (e) => {
      if (
        e.key === "h" ||
        e.key === "Backspace" ||
        (e.key === "ArrowUp" && e.altKey)
      ) {
        e.preventDefault()
        navigate(parentDir)
      }
    },
    [parentDir],
  )

  // Fetch raw file content
  const load = useCallback(
    (signal?: AbortSignal) => {
      if (isHtml || isImage || isVideo) return
      setError(null)
      fetchRaw(path, signal)
        .then((r) => setLoaded({ path, result: r }))
        .catch((err: Error) => {
          if (err.name !== "AbortError") setError(err.message)
        })
    },
    [path, isHtml, isImage, isVideo],
  )

  useAbortEffect((signal) => load(signal), [load])

  // Re-fetch on file changes
  useWS(path.replace(/^\//, ""), () => load())

  // Prev/next among all siblings (dirs included) so navigation matches
  // the sidebar order instead of mysteriously jumping over directories.
  const currentName = path.split("/").pop() ?? ""
  const currentIdx = siblings.findIndex((e) => e.name === currentName)
  const prevEntry = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextEntry =
    currentIdx >= 0 && currentIdx < siblings.length - 1
      ? siblings[currentIdx + 1]
      : null

  const siblingHref = (name: string) =>
    (parentDir === "/" ? "/" : `${parentDir}/`) + name

  // Fresh result for current path, or stale result from previous path
  const freshResult = loaded?.path === path ? loaded.result : null
  const stale = loaded !== null && loaded.path !== path

  const content = stale
    ? renderFileContent(loaded.path, loaded.result, null)
    : renderFileContent(path, freshResult, error)

  return (
    <div class="file-layout">
      <Toolbar path={path} showKeybinds={false} />
      <hr class="file-separator" />
      <div class="file-body">
        <aside class="file-sidebar" style={{ width: `${sidebarWidth}px` }}>
          <a
            rel="up"
            href={parentDir}
            onClick={(e) => {
              e.preventDefault()
              navigate(parentDir)
            }}
          >
            <span class="entry-icon">
              <ParentIcon />
            </span>
            ..
          </a>
          {siblings.map((entry) => {
            const href = siblingHref(entry.name)
            const active = entry.name === currentName && !entry.isDir
            return (
              <a
                key={entry.name}
                href={href}
                class={active ? "sidebar-active" : ""}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(href)
                }}
              >
                <span
                  class={`entry-icon${entry.isDir ? " entry-icon--folder" : ""}`}
                >
                  <FileIcon
                    name={entry.name}
                    isDir={entry.isDir}
                    isExec={entry.isExec ?? false}
                  />
                </span>
                {entry.name}
                {entry.isDir ? "/" : ""}
              </a>
            )
          })}
        </aside>
        <hr
          class="file-sidebar-handle"
          onMouseDown={onHandleMouseDown}
          tabIndex={0}
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-orientation="vertical"
        />
        <div class={`file-content${stale ? " file-content--stale" : ""}`}>
          {content}
        </div>
      </div>
      <footer class="file-footer">
        <span class="file-footer-prev">
          {prevEntry && (
            <a
              rel="prev"
              href={siblingHref(prevEntry.name)}
              onClick={(e) => {
                e.preventDefault()
                navigate(siblingHref(prevEntry.name))
              }}
            >
              <ChevronLeft />
              {prevEntry.name}
            </a>
          )}
        </span>
        <AppFooter />
        <span class="file-footer-next">
          {nextEntry && (
            <a
              rel="next"
              href={siblingHref(nextEntry.name)}
              onClick={(e) => {
                e.preventDefault()
                navigate(siblingHref(nextEntry.name))
              }}
            >
              {nextEntry.name}
              <ChevronRight />
            </a>
          )}
        </span>
      </footer>
    </div>
  )
}
