import type { JSX } from "preact"
import { lazy, Suspense } from "preact/compat"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { AppFooter } from "../components/app-footer"
import { Toolbar } from "../components/toolbar"
import type { RawResult } from "../lib/api"
import {
  clearCache,
  getCached,
  invalidate,
  prefetch,
} from "../lib/content-cache"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { formatSize } from "../lib/format"
import { ChevronLeft, ChevronRight, SidebarIcon } from "../lib/icons"
import { imageRe, videoRe } from "../lib/media-types"
import { navigate } from "../lib/navigate"
import { parentOfFile } from "../lib/path"
import {
  focusSidebarContent,
  goToParent,
  listNavShortcuts,
  toggleSidebar,
} from "../lib/shortcuts"
import { useAbortEffect } from "../lib/use-abort-effect"
import { useListKeys } from "../lib/use-list-keys"
import type { BoundShortcut } from "../lib/use-shortcuts"
import { useShortcuts } from "../lib/use-shortcuts"
import { useSiblings } from "../lib/use-siblings"
import { useWS } from "../lib/use-ws"

const D2View = lazy(() =>
  Promise.all([import("./diagram-view"), import("../lib/d2-render")]).then(
    ([{ DiagramView }, { renderD2 }]) => ({
      default: (props: { content: string }) => (
        <DiagramView
          content={props.content}
          render={renderD2}
          label="D2"
          class="diagram-standalone"
        />
      ),
    }),
  ),
)
const DbmlView = lazy(() =>
  Promise.all([import("./diagram-view"), import("../lib/dbml-render")]).then(
    ([{ DiagramView }, { renderDbml }]) => ({
      default: (props: { content: string }) => (
        <DiagramView
          content={props.content}
          render={renderDbml}
          label="DBML"
          class="diagram-standalone"
        />
      ),
    }),
  ),
)
const GraphvizView = lazy(() =>
  Promise.all([
    import("./diagram-view"),
    import("../lib/graphviz-render"),
  ]).then(([{ DiagramView }, { renderGraphviz }]) => ({
    default: (props: { content: string }) => (
      <DiagramView
        content={props.content}
        render={renderGraphviz}
        label="Graphviz"
        class="diagram-standalone"
      />
    ),
  })),
)
const HtmlView = lazy(() =>
  import("./html-view").then((m) => ({ default: m.HtmlView })),
)
const MediaView = lazy(() =>
  import("./media-view").then((m) => ({ default: m.MediaView })),
)
const TypstView = lazy(() =>
  Promise.all([import("./diagram-view"), import("../lib/typst-render")]).then(
    ([{ DiagramView }, { renderTypst }]) => ({
      default: (props: { content: string }) => (
        <DiagramView
          content={props.content}
          render={renderTypst}
          label="Typst"
          class="diagram-standalone"
        />
      ),
    }),
  ),
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
const YamlStructuredView = lazy(() =>
  Promise.all([import("./structured-view"), import("yaml")]).then(
    ([{ StructuredView: SV }, { parse }]) => ({
      default: (props: { content: string }) => (
        <SV content={props.content} parse={parse} lang="yaml" />
      ),
    }),
  ),
)

function isPrefetchable(name: string, isDir: boolean): boolean {
  if (isDir) return false
  if (/\.html?$/i.test(name)) return false
  if (imageRe.test(name) || videoRe.test(name)) return false
  return true
}

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
        <YamlStructuredView content={result.content} />
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
const SIDEBAR_OPEN_KEY = "dirsv-sidebar-open"
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

const fileShortcutBindings = (
  parentDir: string,
  onToggleSidebar: () => void,
): BoundShortcut[] => [
  {
    def: goToParent,
    action(e) {
      e.preventDefault()
      navigate(parentDir)
    },
  },
  {
    def: toggleSidebar,
    action(e) {
      e.preventDefault()
      onToggleSidebar()
    },
  },
]

export function FileView({ path }: Props) {
  const isHtml = /\.html?$/i.test(path)
  const isImage = imageRe.test(path)
  const isVideo = videoRe.test(path)

  // Sidebar visibility — persist to localStorage, fall back to viewport check
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_OPEN_KEY)
      if (stored === "1") return true
      if (stored === "0") return false
    } catch {
      // localStorage may be unavailable
    }
    return window.innerWidth > 768
  })
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0")
      } catch {
        // localStorage may be unavailable
      }
      return next
    })
  }, [])

  // Sidebar list keyboard navigation
  const sidebarRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)
  useListKeys(sidebarRef, "a")

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

  const SIDEBAR_STEP = 10
  const onHandleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let next: number | null = null
      if (e.key === "ArrowLeft")
        next = Math.max(SIDEBAR_MIN, sidebarWidth - SIDEBAR_STEP)
      else if (e.key === "ArrowRight")
        next = Math.min(SIDEBAR_MAX, sidebarWidth + SIDEBAR_STEP)
      else if (e.key === "Home") next = SIDEBAR_MIN
      else if (e.key === "End") next = SIDEBAR_MAX
      if (next === null) return
      e.preventDefault()
      widthRef.current = next
      setSidebarWidth(next)
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next))
      } catch {
        // localStorage may be unavailable
      }
    },
    [sidebarWidth],
  )

  // Cross-tab sync for sidebar visibility and width
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === SIDEBAR_OPEN_KEY) {
        setSidebarOpen(e.newValue === "1")
      } else if (e.key === SIDEBAR_WIDTH_KEY) {
        const n = Number(e.newValue)
        if (n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) {
          widthRef.current = n
          setSidebarWidth(n)
        }
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
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

  const focusSidebarLink = useCallback(() => {
    sidebarRef.current?.querySelector<HTMLElement>(".sidebar-active")?.focus()
  }, [])

  // Focus sidebar active link after it opens via ctrl-e
  useEffect(() => {
    if (sidebarOpen && pendingFocus.current) {
      pendingFocus.current = false
      focusSidebarLink()
    }
  }, [sidebarOpen, focusSidebarLink])

  const focusSidebarOrContent = useCallback(() => {
    const inSidebar = sidebarRef.current?.contains(document.activeElement)
    if (inSidebar) {
      contentRef.current?.focus()
      return
    }
    if (!sidebarOpen) {
      pendingFocus.current = true
      handleToggleSidebar()
      return
    }
    focusSidebarLink()
  }, [sidebarOpen, handleToggleSidebar, focusSidebarLink])

  const boundShortcuts = useMemo(
    () => [
      ...fileShortcutBindings(parentDir, handleToggleSidebar),
      {
        def: focusSidebarContent,
        action(e: KeyboardEvent) {
          e.preventDefault()
          focusSidebarOrContent()
        },
      },
    ],
    [parentDir, handleToggleSidebar, focusSidebarOrContent],
  )
  const shortcutDefs = useShortcuts(boundShortcuts)

  // Fetch raw file content — delegates to prefetch() for cache/dedup/abort.
  const load = useCallback(
    (signal?: AbortSignal) => {
      if (isHtml || isImage || isVideo) return
      setError(null)
      const cached = getCached(path)
      if (cached) {
        setLoaded({ path, result: cached })
        return
      }
      const p = prefetch(path, signal)
      if (!p) return
      p.then((r) => {
        if (!signal?.aborted) setLoaded({ path, result: r })
      }).catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message)
      })
    },
    [path, isHtml, isImage, isVideo],
  )

  useAbortEffect((signal) => load(signal), [load])

  // Re-fetch on file changes — invalidate cache so we get fresh content
  useWS(path.replace(/^\//, ""), () => {
    invalidate(path)
    load()
  })

  // Clear cache when switching directories — siblings change entirely
  const prevParentRef = useRef(parentDir)
  useEffect(() => {
    if (prevParentRef.current !== parentDir) {
      clearCache()
      prevParentRef.current = parentDir
    }
  }, [parentDir])

  // Prev/next among all siblings (dirs included) so navigation matches
  // the sidebar order instead of mysteriously jumping over directories.
  const currentName = path.split("/").pop() ?? ""
  const currentIdx = siblings.findIndex((e) => e.name === currentName)
  const prevEntry = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextEntry =
    currentIdx >= 0 && currentIdx < siblings.length - 1
      ? siblings[currentIdx + 1]
      : null

  const siblingHref = useCallback(
    (name: string) => (parentDir === "/" ? "/" : `${parentDir}/`) + name,
    [parentDir],
  )

  // Prefetch adjacent siblings once the current file finishes loading
  const loadedPath = loaded?.path
  useEffect(() => {
    if (loadedPath !== path) return
    const controller = new AbortController()
    for (const entry of [prevEntry, nextEntry]) {
      if (entry && isPrefetchable(entry.name, entry.isDir)) {
        void prefetch(siblingHref(entry.name), controller.signal)
      }
    }
    return () => controller.abort()
  }, [loadedPath, path, prevEntry, nextEntry, siblingHref])

  // Fresh result for current path, or stale result from previous path.
  // Media types (images, videos, HTML) don't use fetchRaw — never show stale content for them.
  const freshResult = loaded?.path === path ? loaded.result : null
  const needsRaw = !(isHtml || isImage || isVideo)
  const stale = needsRaw && loaded !== null && loaded.path !== path

  const content = useMemo(
    () =>
      stale
        ? renderFileContent(loaded?.path ?? path, loaded?.result ?? null, null)
        : renderFileContent(path, freshResult, error),
    [stale, loaded, path, freshResult, error],
  )

  const sidebarToggleBtn = (
    <button
      type="button"
      class="theme-toggle"
      onClick={handleToggleSidebar}
      aria-label="Toggle sidebar"
      aria-pressed={sidebarOpen}
      title="Toggle sidebar"
    >
      <SidebarIcon />
    </button>
  )

  return (
    <div class="file-layout">
      <Toolbar
        path={path}
        shortcuts={[...shortcutDefs, ...listNavShortcuts]}
        actions={sidebarToggleBtn}
      />
      <hr class="file-separator" />
      <div class="file-body">
        {sidebarOpen && (
          <aside
            class="file-sidebar"
            style={{ width: `${sidebarWidth}px` }}
            ref={sidebarRef}
            aria-label="Sibling files"
          >
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
                  onPointerEnter={
                    isPrefetchable(entry.name, entry.isDir)
                      ? () => prefetch(href)
                      : undefined
                  }
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
        )}
        {sidebarOpen && (
          <hr
            class="file-sidebar-handle"
            aria-label="Resize sidebar"
            onMouseDown={onHandleMouseDown}
            onKeyDown={onHandleKeyDown}
            tabIndex={0}
            aria-valuenow={sidebarWidth}
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuetext={`${sidebarWidth} pixels`}
            aria-orientation="vertical"
          />
        )}
        <div
          ref={contentRef}
          tabIndex={-1}
          class={`file-content${stale ? " file-content--stale" : ""}`}
        >
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
              onPointerEnter={
                isPrefetchable(prevEntry.name, prevEntry.isDir)
                  ? () => prefetch(siblingHref(prevEntry.name))
                  : undefined
              }
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
              onPointerEnter={
                isPrefetchable(nextEntry.name, nextEntry.isDir)
                  ? () => prefetch(siblingHref(nextEntry.name))
                  : undefined
              }
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
