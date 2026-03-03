import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"
import { browse } from "../lib/api"
import { useKeys } from "../lib/use-keys"
import { useSSE } from "../lib/use-sse"

interface Props {
  path: string
  kind: "image" | "video"
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

const videoExts = new Set([".mp4", ".webm", ".ogg", ".mov"])

function extOf(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot < 0 ? "" : name.slice(dot).toLowerCase()
}

function matchesKind(name: string, kind: "image" | "video"): boolean {
  const ext = extOf(name)
  return kind === "image" ? imageExts.has(ext) : videoExts.has(ext)
}

function navigate(to: string) {
  // Encode each path segment so the URL bar displays proper percent-encoding.
  const encoded = to
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
  history.pushState(null, "", encoded)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function MediaView({ path, kind }: Props) {
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
          const items = data.entries
            .filter((e) => !e.isDir && matchesKind(e.name, kind))
            .map((e) => {
              const dir = parentDir === "/" ? "" : parentDir
              return `${dir}/${e.name}`
            })
          setSiblings(items)
        })
        .catch(() => {
          // Silently ignore — parent directory may be inaccessible.
        })
    },
    [parentDir, kind],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadSiblings(controller.signal)
    return () => controller.abort()
  }, [loadSiblings])

  useSSE(parentDir.replace(/^\//, "") || ".", () => loadSiblings())

  const currentIdx = siblings.indexOf(path)
  const prevPath = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextPath =
    currentIdx >= 0 && currentIdx < siblings.length - 1
      ? siblings[currentIdx + 1]
      : null

  useKeys(
    (e) => {
      if (e.key === "ArrowLeft" && prevPath) {
        e.preventDefault()
        navigate(prevPath)
      } else if (e.key === "ArrowRight" && nextPath) {
        e.preventDefault()
        navigate(nextPath)
      }
    },
    [prevPath, nextPath],
  )

  const rawUrl = `/api/raw${path}`
  const fileName = path.split("/").pop() ?? path
  const position =
    currentIdx >= 0 ? `${currentIdx + 1} / ${siblings.length}` : ""

  // Fade-in: track whether the current image has loaded.
  // Using key={rawUrl} on the <img> forces a fresh element per image,
  // so loaded always starts false and onLoad fires after mount.
  const [loaded, setLoaded] = useState(false)

  // Preload adjacent images for instant transitions.
  useEffect(() => {
    if (kind !== "image") return
    const toPreload = [prevPath, nextPath].filter(Boolean) as string[]
    for (const p of toPreload) {
      const img = new Image()
      img.src = `/api/raw${p}`
    }
  }, [prevPath, nextPath, kind])

  return (
    <div>
      <Toolbar path={path} />
      <div class="media-viewer">
        <div class="media-container">
          {kind === "image" ? (
            <img
              key={rawUrl}
              src={rawUrl}
              alt={fileName}
              class={`media-content media-fade ${loaded ? "media-fade--in" : ""}`}
              onLoad={() => setLoaded(true)}
            />
          ) : (
            <video src={rawUrl} controls class="media-content">
              <track kind="captions" />
            </video>
          )}
        </div>
        {siblings.length > 1 && (
          <div class="media-nav">
            <button
              type="button"
              class="media-nav-btn"
              disabled={!prevPath}
              onClick={() => prevPath && navigate(prevPath)}
              aria-label={`Previous ${kind}`}
            >
              <ChevronLeft />
            </button>
            <span class="media-nav-pos">{position}</span>
            <button
              type="button"
              class="media-nav-btn"
              disabled={!nextPath}
              onClick={() => nextPath && navigate(nextPath)}
              aria-label={`Next ${kind}`}
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
