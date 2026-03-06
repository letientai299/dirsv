import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { ChevronLeft, ChevronRight } from "../lib/icons"
import { imageExts, videoExts } from "../lib/media-types"
import { navigate } from "../lib/navigate"
import { parentOf } from "../lib/path"
import { useKeys } from "../lib/use-keys"
import { useSiblings } from "../lib/use-siblings"
import { useWS } from "../lib/use-ws"

interface Props {
  path: string
  kind: "image" | "video"
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot < 0 ? "" : name.slice(dot).toLowerCase()
}

function matchesKind(name: string, kind: "image" | "video"): boolean {
  const ext = extOf(name)
  return kind === "image" ? imageExts.has(ext) : videoExts.has(ext)
}

export function MediaView({ path, kind }: Props) {
  const parentDir = useMemo(() => parentOf(path), [path])
  const allSiblings = useSiblings(parentDir)

  const siblings = useMemo(() => {
    const dir = parentDir === "/" ? "" : parentDir
    return allSiblings
      .filter((e) => !e.isDir && matchesKind(e.name, kind))
      .map((e) => `${dir}/${e.name}`)
  }, [allSiblings, parentDir, kind])

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

  // Bump revision on file changes so the browser re-fetches the asset.
  const [rev, setRev] = useState(0)
  useWS(
    path.replace(/^\//, ""),
    useCallback(() => setRev((r) => r + 1), []),
  )

  const rawUrl = `/api/raw${path}${rev ? `?v=${rev}` : ""}`
  const fileName = path.split("/").pop() ?? path
  const position =
    currentIdx >= 0 ? `${currentIdx + 1} / ${siblings.length}` : ""

  // Fade-in: track whether the current image has loaded.
  const [loaded, setLoaded] = useState(false)

  // Reset fade state when the image changes so each new image fades in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on rawUrl change
  useEffect(() => {
    setLoaded(false)
  }, [rawUrl])

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
  )
}
