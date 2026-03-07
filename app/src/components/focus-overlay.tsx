import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import type { FocusItem } from "../lib/use-focus-overlay"
import { useModalKeys } from "../lib/use-keys"
import { useZoom } from "../lib/use-zoom"

const PAN_STEP = 80

interface Props {
  items: FocusItem[]
  startIndex: number
  onClose: () => void
  onIndexChange?: (index: number) => void
}

export function FocusOverlay({
  items,
  startIndex,
  onClose,
  onIndexChange,
}: Props) {
  const [index, setIndex] = useState(startIndex)
  const overlayRef = useRef<HTMLDivElement>(null)
  const zoom = useZoom()
  const { resetZoom, zoomIn, zoomOut, panBy } = zoom

  const total = items.length
  // items is always non-empty when FocusOverlay is rendered.
  const item = items[index] as FocusItem
  const hasPrev = index > 0
  const hasNext = index < total - 1

  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
    resetZoom()
  }, [resetZoom])

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1))
    resetZoom()
  }, [items.length, resetZoom])

  // Reset index if startIndex changes (re-open on different item).
  useEffect(() => {
    setIndex(startIndex)
    resetZoom()
  }, [startIndex, resetZoom])

  // Scroll lock.
  useEffect(() => {
    document.documentElement.classList.add("focus-lock")
    return () => document.documentElement.classList.remove("focus-lock")
  }, [])

  // Focus the overlay on mount for keyboard events.
  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  // Keyboard shortcuts — modal layer suppresses all global shortcuts.
  useModalKeys((e: KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        onClose()
        break
      case "ArrowLeft":
        e.preventDefault()
        goPrev()
        break
      case "ArrowRight":
        e.preventDefault()
        goNext()
        break
      case "+":
      case "=":
        e.preventDefault()
        zoomIn()
        break
      case "-":
        e.preventDefault()
        zoomOut()
        break
      case "0":
        e.preventDefault()
        resetZoom()
        break
      case "h":
        e.preventDefault()
        panBy(PAN_STEP, 0)
        break
      case "j":
        e.preventDefault()
        panBy(0, -PAN_STEP)
        break
      case "k":
        e.preventDefault()
        panBy(0, PAN_STEP)
        break
      case "l":
        e.preventDefault()
        panBy(-PAN_STEP, 0)
        break
      case "f":
      case "F":
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          void document.documentElement.requestFullscreen?.()
        }
        break
    }
  })

  // Focus trap — keep Tab within overlay.
  const onKeyDownCapture = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab") return
    const el = overlayRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  // Preload adjacent images for smoother navigation.
  useEffect(() => {
    for (const i of [index - 1, index + 1]) {
      const neighbor = items[i]
      if (neighbor?.type === "image") {
        const img = new Image()
        img.src = neighbor.src
      }
    }
  }, [index, items])

  return (
    <div
      ref={overlayRef}
      class="focus-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Focus view"
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
    >
      <button
        type="button"
        class="focus-backdrop"
        onClick={onClose}
        aria-label="Close overlay"
      />

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by useModalKeys */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: zoom container needs pointer events */}
      <div
        class="focus-content"
        ref={zoom.containerRef}
        onPointerDown={zoom.onPointerDown}
        onPointerMove={zoom.onPointerMove}
        onPointerUp={zoom.onPointerUp}
        onClick={zoom.onClick}
      >
        <div style={zoom.style}>
          <FocusContent item={item} />
        </div>
      </div>

      <button
        type="button"
        class="focus-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {total > 1 && (
        <div class="focus-bar">
          <button
            type="button"
            class="focus-bar-btn"
            disabled={!hasPrev}
            onClick={goPrev}
            aria-label="Previous"
          >
            ‹
          </button>
          <span class="focus-bar-pos">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            class="focus-bar-btn"
            disabled={!hasNext}
            onClick={goNext}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

function FocusContent({ item }: { item: FocusItem }) {
  switch (item.type) {
    case "image":
      return (
        <img
          src={item.src}
          alt={item.alt}
          class="focus-media"
          draggable={false}
        />
      )
    case "video":
      return (
        <video src={item.src} controls class="focus-media">
          <track kind="captions" />
        </video>
      )
    case "diagram":
      return <FocusDiagram svg={item.svg} />
  }
}

/** Render diagram SVG with inline max-width stripped so it scales to fit. */
function FocusDiagram({ svg }: { svg: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = svg
    // Strip inline max-width from diagram renderers (e.g. mermaid).
    const svgEl = el.querySelector("svg")
    if (svgEl) {
      svgEl.style.removeProperty("max-width")
      // Mermaid sets width="100%" which stretches SVG to parent width,
      // ignoring aspect ratio. Remove it so max-height can constrain.
      if (svgEl.getAttribute("width") === "100%") {
        svgEl.removeAttribute("width")
      }
    }
  }, [svg])
  return <div class="focus-diagram" ref={ref} />
}
