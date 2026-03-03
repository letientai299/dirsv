import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"
import { browse } from "../lib/api"
import { useSSE } from "../lib/use-sse"

interface Props {
  path: string
}

const imageExts = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
])

function isImage(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return imageExts.has(name.slice(dot).toLowerCase())
}

function navigate(to: string) {
  history.pushState(null, "", to)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function ImageView({ path }: Props) {
  const [siblings, setSiblings] = useState<string[]>([])

  const parentDir = useMemo(() => {
    const parts = path.replace(/^\//, "").split("/")
    parts.pop()
    return parts.length === 0 ? "/" : `/${parts.join("/")}`
  }, [path])

  const loadSiblings = useCallback(
    (signal?: AbortSignal) => {
      browse(parentDir, signal)
        .then((data) => {
          if (data.type !== "dir") return
          const images = data.entries
            .filter((e) => !e.isDir && isImage(e.name))
            .map((e) => {
              const dir = parentDir === "/" ? "" : parentDir
              return `${dir}/${e.name}`
            })
          setSiblings(images)
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

  // Refresh sibling list on directory changes.
  useSSE(parentDir.replace(/^\//, "") || ".", () => loadSiblings())

  const currentIdx = siblings.indexOf(path)
  const prevPath = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextPath =
    currentIdx >= 0 && currentIdx < siblings.length - 1
      ? siblings[currentIdx + 1]
      : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.target instanceof HTMLTextAreaElement) return

      if (e.key === "ArrowLeft" && prevPath) {
        e.preventDefault()
        navigate(prevPath)
      } else if (e.key === "ArrowRight" && nextPath) {
        e.preventDefault()
        navigate(nextPath)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prevPath, nextPath])

  const rawUrl = `/api/raw${path}`
  const fileName = path.split("/").pop() ?? path
  const position =
    currentIdx >= 0 ? `${currentIdx + 1} / ${siblings.length}` : ""

  return (
    <div>
      <Toolbar path={path} />
      <div class="img-viewer">
        <div class="img-container">
          <img src={rawUrl} alt={fileName} class="img-preview" />
        </div>
        {siblings.length > 1 && (
          <div class="img-nav">
            <button
              type="button"
              class="img-nav-btn"
              disabled={!prevPath}
              onClick={() => prevPath && navigate(prevPath)}
              aria-label="Previous image"
            >
              <ChevronLeft />
            </button>
            <span class="img-nav-pos">{position}</span>
            <button
              type="button"
              class="img-nav-btn"
              disabled={!nextPath}
              onClick={() => nextPath && navigate(nextPath)}
              aria-label="Next image"
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
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
