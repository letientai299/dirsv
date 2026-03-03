import type { JSX } from "preact"
import { lazy, Suspense } from "preact/compat"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { parse as parseYaml } from "yaml"
import { Toolbar } from "../components/toolbar"
import { browse, type DirEntry, fetchRaw, type RawResult } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { useKeys } from "../lib/use-keys"
import { useSSE } from "../lib/use-sse"
import { D2View } from "./d2-view"
import { DbmlView } from "./dbml-view"
import { GraphvizView } from "./graphviz-view"
import { HtmlView } from "./html-view"
import { MediaView } from "./media-view"
import { TypstView } from "./typst-view"

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
  if (/\.html?$/i.test(path)) return <HtmlView path={path} />
  if (imageRe.test(path)) return <MediaView path={path} kind="image" />
  if (videoRe.test(path)) return <MediaView path={path} kind="video" />
  if (error) return <div class="error">Error: {error}</div>
  if (result === null) return fallback
  if (result.kind === "binary") {
    const name = path.split("/").pop() ?? path
    return (
      <div class="file-binary">
        <p>
          Binary file ({result.contentType}, {formatSize(result.size)})
        </p>
        <a href={result.url} download={name}>
          Download {name}
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
    return <GraphvizView content={result.content} />
  if (/\.d2$/i.test(path)) return <D2View content={result.content} />
  if (/\.dbml$/i.test(path)) return <DbmlView content={result.content} />
  if (/\.typ$/i.test(path)) return <TypstView content={result.content} />
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

export function FileView({ path }: Props) {
  const isHtml = /\.html?$/i.test(path)
  const isImage = imageRe.test(path)
  const isVideo = videoRe.test(path)
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

  // Prev/next among non-directory siblings
  const currentName = path.split("/").pop() ?? ""
  const fileEntries = useMemo(
    () => siblings.filter((e) => !e.isDir),
    [siblings],
  )
  const currentIdx = fileEntries.findIndex((e) => e.name === currentName)
  const prevFile = currentIdx > 0 ? fileEntries[currentIdx - 1] : null
  const nextFile =
    currentIdx >= 0 && currentIdx < fileEntries.length - 1
      ? fileEntries[currentIdx + 1]
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
        <aside class="file-sidebar">
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
        <div class={`file-content${stale ? " file-content--stale" : ""}`}>
          {content}
        </div>
      </div>
      {(prevFile || nextFile) && (
        <footer class="file-footer">
          {prevFile ? (
            <a
              rel="prev"
              href={siblingHref(prevFile.name)}
              onClick={(e) => {
                e.preventDefault()
                navigate(siblingHref(prevFile.name))
              }}
            >
              <ChevronLeft />
              {prevFile.name}
            </a>
          ) : (
            <span />
          )}
          {nextFile ? (
            <a
              rel="next"
              href={siblingHref(nextFile.name)}
              onClick={(e) => {
                e.preventDefault()
                navigate(siblingHref(nextFile.name))
              }}
            >
              {nextFile.name}
              <ChevronRight />
            </a>
          ) : (
            <span />
          )}
        </footer>
      )}
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
