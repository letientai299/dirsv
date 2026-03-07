import { useCallback, useEffect, useRef, useState } from "preact/hooks"

interface ZoomState {
  scale: number
  x: number
  y: number
}

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const ZOOM_STEP = 1.2

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

/** Compute new zoom state centered on a point (px, py) in container coords. */
function zoomAt(
  px: number,
  py: number,
  newScale: number,
  s: ZoomState,
): ZoomState {
  const ratio = newScale / s.scale
  return {
    scale: newScale,
    x: px - ratio * (px - s.x),
    y: py - ratio * (py - s.y),
  }
}

/**
 * Zoom/pan state for content inside the focus overlay.
 *
 * - Scroll-wheel zoom (centered on pointer)
 * - Click-to-toggle between fit (scale=1) and 2x zoom (drag threshold: 5px)
 * - Drag-to-pan when zoomed beyond viewport
 * - Pinch-to-zoom via pointer events
 * - +/-/0 keyboard shortcuts (handled externally, exposed via zoomIn/zoomOut/resetZoom)
 */
export function useZoom() {
  const [state, setState] = useState<ZoomState>({ scale: 1, x: 0, y: 0 })
  const stateRef = useRef(state)
  stateRef.current = state
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, sx: 0, sy: 0 })
  // Track active pointers for pinch-to-zoom.
  const pointers = useRef<Map<number, PointerEvent>>(new Map())
  const lastPinchDist = useRef(0)

  const resetZoom = useCallback(() => {
    setState({ scale: 1, x: 0, y: 0 })
  }, [])

  // Zoom centered on the viewport middle.
  const zoomTo = useCallback((newScale: number, s: ZoomState): ZoomState => {
    const el = containerRef.current
    if (!el) return { ...s, scale: newScale }
    const { width, height } = el.getBoundingClientRect()
    return zoomAt(width / 2, height / 2, newScale, s)
  }, [])

  const zoomIn = useCallback(() => {
    setState((s) => zoomTo(clampScale(s.scale * ZOOM_STEP), s))
  }, [zoomTo])

  const zoomOut = useCallback(() => {
    setState((s) => zoomTo(clampScale(s.scale / ZOOM_STEP), s))
  }, [zoomTo])

  const panBy = useCallback((dx: number, dy: number) => {
    setState((s) => ({ ...s, x: s.x + dx, y: s.y + dy }))
  }, [])

  const onClick = useCallback((e: MouseEvent) => {
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    const el = containerRef.current
    if (!el) return
    if (stateRef.current.scale === 1) {
      // Zoom in centered on click position.
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setState((s) => zoomAt(px, py, 2, s))
    } else {
      setState({ scale: 1, x: 0, y: 0 })
    }
  }, [])

  // Wheel zoom centered on pointer position.
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    setState((s) => {
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      return zoomAt(px, py, clampScale(s.scale * factor), s)
    })
  }, [])

  // Drag-to-pan.
  const onPointerDown = useCallback((e: PointerEvent) => {
    const el = containerRef.current
    if (!el) return

    pointers.current.set(e.pointerId, e)
    el.setPointerCapture(e.pointerId)

    if (pointers.current.size === 1) {
      dragging.current = true
      didDrag.current = false
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        sx: stateRef.current.x,
        sy: stateRef.current.y,
      }
    } else if (pointers.current.size === 2) {
      // Start pinch — compute initial distance.
      const [a, b] = [...pointers.current.values()]
      if (a && b) {
        lastPinchDist.current = Math.hypot(
          b.clientX - a.clientX,
          b.clientY - a.clientY,
        )
      }
    }
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    pointers.current.set(e.pointerId, e)

    if (pointers.current.size === 2) {
      // Pinch-to-zoom.
      const [a, b] = [...pointers.current.values()]
      if (a && b) {
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
        if (lastPinchDist.current > 0) {
          const factor = dist / lastPinchDist.current
          setState((s) => ({ ...s, scale: clampScale(s.scale * factor) }))
        }
        lastPinchDist.current = dist
      }
      return
    }

    if (!dragging.current) return

    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (!didDrag.current && Math.hypot(dx, dy) > 5) {
      didDrag.current = true
    }
    setState((s) => ({
      ...s,
      x: dragStart.current.sx + dx,
      y: dragStart.current.sy + dy,
    }))
  }, [])

  const onPointerUp = useCallback((e: PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) {
      lastPinchDist.current = 0
    }
    if (pointers.current.size === 1) {
      // One finger left after pinch — stop panning, suppress the upcoming click.
      dragging.current = false
      didDrag.current = true
    }
    if (pointers.current.size === 0) {
      dragging.current = false
    }
  }, [])

  // Attach wheel listener with { passive: false } to prevent page scroll.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [onWheel])

  const style = {
    width: "100%",
    height: "100%",
    transform: `translate(${state.x}px, ${state.y}px) scale(${state.scale})`,
    transformOrigin: "0 0",
    cursor: state.scale > 1 ? "grab" : "zoom-in",
    touchAction: "none" as const,
  }

  return {
    containerRef,
    style,
    scale: state.scale,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    zoomIn,
    zoomOut,
    panBy,
    resetZoom,
    onClick,
  }
}
