import type { JSX } from "preact"
import { lazy, Suspense } from "preact/compat"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { parse as parseYaml } from "yaml"
import { AppFooter } from "../components/app-footer"
import { Toolbar } from "../components/toolbar"
import { browse, type DirEntry, fetchRaw, type RawResult } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { useKeys } from "../lib/use-keys"
import { useSSE } from "../lib/use-sse"

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
const StructuredView = lazy(() =>
  import("./structured-view").then((m) => ({ default: m.StructuredView })),
)

interface Props {
  path: string
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** i
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

const imageRe = /\.(apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i
const videoRe = /\.(mp4|webm|ogg|mov)$/i
const fallback = <div class="loading">Loading...</div>

function navigate(to: string) {
  history.pushState(null, "", to)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

function parentOf(path: string): string {
  const dir = path.replace(/\/[^/]+$/, "") || "/"
  // For index.html, go up two levels to avoid re-triggering the index.
  return /\/index\.html?$/i.test(path)
    ? dir.replace(/\/[^/]+$/, "") || "/"
    : dir
}

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
  const dragging = useRef(false)

  const onHandleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX))
      setSidebarWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      setSidebarWidth((w) => {
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w))
        } catch {
          // ignore
        }
        return w
      })
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
  const [siblings, setSiblings] = useState<DirEntry[]>([])

  const parentDir = useMemo(() => parentOf(path), [path])

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

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Re-fetch on file changes
  useSSE(path.replace(/^\//, ""), () => load())

  // Fetch sibling entries from parent directory
  const loadSiblings = useCallback(
    (signal?: AbortSignal) => {
      browse(parentDir, signal)
        .then((data) => {
          if (data.type === "dir") setSiblings(data.entries)
        })
        .catch(() => {
          // Silently ignore — parent directory may be inaccessible.
        })
    },
    [parentDir],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadSiblings(controller.signal)
    return () => controller.abort()
  }, [loadSiblings])

  useSSE(parentDir.replace(/^\//, "") || ".", () => loadSiblings())

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
      <Toolbar path={path} />
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

function ChevronLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.749.749 0 1 1 1.06 1.06L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 1 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  )
}
