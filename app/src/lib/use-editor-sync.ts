import type { RefObject } from "preact"
import { type MutableRef, useCallback, useEffect, useRef } from "preact/hooks"
import { watchPrefix } from "./path"
import type { WsEvent } from "./use-ws"
import { useWS } from "./use-ws"

export interface EditorState {
  scroll?: { topLine: number; bottomLine: number; total: number }
  cursor?: { line: number }
  selection?: { startLine: number; endLine: number }
  /** Which event type triggered this update — drives scroll-into-view. */
  trigger?: "scroll" | "cursor" | "selection"
}

/** Where to scroll: the cursor line and its relative position in the
 *  editor viewport (0 = top, 0.5 = center, 1 = bottom). */
export interface ScrollTarget {
  line: number
  ratio: number
  /** When true, always reposition to the exact ratio (scroll events, zz/zt/zb).
   *  When false, only scroll if the element is outside the visible viewport. */
  exact: boolean
}

/** Callback invoked on each editor sync event — do imperative DOM work here
 *  instead of going through setState → re-render → effect. */
export type EditorSyncCallback = (state: EditorState) => void

const USER_SCROLL_TIMEOUT = 2000

/** Scroll deltas below this threshold (px) are ignored to avoid
 *  unnecessary scroll events and the programmatic-flag dance. */
const SCROLL_THRESHOLD = 2

/** Compute the cursor's relative position within the editor viewport.
 *  zz → ~0.5, zt → ~0, zb → ~1. Falls back to 0 (top) when missing. */
function viewportRatio(
  cursorLine: number,
  scroll?: EditorState["scroll"],
): number {
  if (!scroll) return 0
  const range = scroll.bottomLine - scroll.topLine
  if (range <= 0) return 0
  return Math.max(0, Math.min(1, (cursorLine - scroll.topLine) / range))
}

/** Derive the scroll target from an editor state update. */
function scrollTargetFromState(state: EditorState): ScrollTarget | null {
  switch (state.trigger) {
    case "cursor":
      if (!state.cursor) return null
      return {
        line: state.cursor.line,
        ratio: viewportRatio(state.cursor.line, state.scroll),
        exact: false,
      }
    case "selection": {
      if (!state.selection) return null
      const line = Math.min(state.selection.startLine, state.selection.endLine)
      return { line, ratio: viewportRatio(line, state.scroll), exact: false }
    }
    case "scroll":
      // Pure scroll event — reposition to exact ratio.
      return state.scroll
        ? { line: state.scroll.topLine, ratio: 0, exact: true }
        : null
    default:
      return null
  }
}

/** Fraction of the scroller height used as a margin when checking visibility.
 *  Keeps the element from sitting right at the edge before we scroll. */
const VISIBLE_MARGIN = 0.05

/** Scroll `el` so it sits at `target.ratio` within the nearest `.file-content`
 *  scroll container. When `target.exact` is false (cursor/selection moves),
 *  the scroll is skipped if the element is already within the visible viewport
 *  — this avoids jarring jumps on every `j`/`k` keystroke. */
function scrollElementToRatio(
  el: HTMLElement,
  target: ScrollTarget,
  programmaticFlag: { current: boolean },
): void {
  const scroller = el.closest(".file-content")
  if (!scroller) return

  const elRect = el.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()

  // For cursor/selection events, skip the scroll when the element's top edge
  // is comfortably inside the viewport.  We only test the top — not bottom —
  // because in markdown the matched element may sit well above the actual
  // cursor line (sparse data-source-line annotations), and requiring the
  // bottom to also be in view would miss offscreen content below.
  if (!target.exact) {
    const margin = scrollerRect.height * VISIBLE_MARGIN
    if (
      elRect.top >= scrollerRect.top + margin &&
      elRect.top <= scrollerRect.bottom - margin
    ) {
      return
    }
  }

  const delta =
    elRect.top - (scrollerRect.top + target.ratio * scrollerRect.height)
  if (Math.abs(delta) < SCROLL_THRESHOLD) return

  programmaticFlag.current = true
  scroller.scrollTop += delta
  requestAnimationFrame(() => {
    programmaticFlag.current = false
  })
}

/**
 * Shared hook: subscribes to editor sync events, tracks scroll-fight state,
 * and attaches the scroll listener to the nearest `.file-content` ancestor.
 *
 * `onEditorEvent` is called directly from the WS handler (no setState, no
 * re-render) so the view can do imperative DOM work immediately. Views must
 * also call their highlight logic from a useEffect([html]/[result]) to
 * reapply after Shiki/morphdom replaces the DOM.
 *
 * Returns `editorRef` (current state) and `consumeScroll` (consume the
 * pending scroll target and scroll the element returned by `findEl`).
 */
export function useEditorSyncState(
  path: string,
  containerRef: RefObject<HTMLElement>,
  onEditorEvent: EditorSyncCallback,
): {
  editorRef: MutableRef<EditorState>
  consumeScroll: (findEl: (line: number) => HTMLElement | null) => void
} {
  const editorRef = useRef<EditorState>({})
  const scrollTargetRef = useRef<ScrollTarget | null>(null)
  const onEditorEventRef = useRef(onEditorEvent)
  onEditorEventRef.current = onEditorEvent

  useEditorSync(watchPrefix(path), (state) => {
    editorRef.current = state
    scrollTargetRef.current = scrollTargetFromState(state)
    onEditorEventRef.current(state)
  })

  // Scroll-fight prevention: suppress programmatic scroll while user scrolls.
  const userScrollingRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const programmaticScrollRef = useRef(false)

  const onUserScroll = useCallback(() => {
    if (programmaticScrollRef.current) return
    userScrollingRef.current = true
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false
    }, USER_SCROLL_TIMEOUT)
  }, [])

  useEffect(() => {
    const el = containerRef.current?.closest(".file-content")
    if (!el) return
    el.addEventListener("scroll", onUserScroll, { passive: true })
    return () => el.removeEventListener("scroll", onUserScroll)
  }, [onUserScroll, containerRef])

  const consumeScroll = useCallback(
    (findEl: (line: number) => HTMLElement | null) => {
      const target = scrollTargetRef.current
      scrollTargetRef.current = null
      if (!target || userScrollingRef.current) return
      const el = findEl(target.line)
      if (el) scrollElementToRatio(el, target, programmaticScrollRef)
    },
    [],
  )

  return { editorRef, consumeScroll }
}

const editorTypes = new Set(["scroll", "cursor", "selection", "clear"])

/**
 * Subscribes to editor sync events for the given path and calls onUpdate
 * with the accumulated editor state. A "clear" event resets to {}.
 */
export function useEditorSync(
  path: string,
  onUpdate: (state: EditorState) => void,
): void {
  const stateRef = useRef<EditorState>({})
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  // Reset accumulated state when path changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: path triggers reset intentionally
  useEffect(() => {
    stateRef.current = {}
  }, [path])

  const handler = useCallback((ev: WsEvent) => {
    if (!editorTypes.has(ev.type)) return

    const prev = stateRef.current
    let next: EditorState

    // Merged events carry viewport info alongside cursor/selection.
    const scrollFromEvent =
      ev.topLine != null
        ? {
            scroll: {
              topLine: ev.topLine,
              bottomLine: ev.bottomLine ?? ev.topLine,
              total: ev.total ?? 0,
            },
          }
        : undefined

    switch (ev.type) {
      case "scroll":
        next = {
          ...prev,
          trigger: "scroll",
          scroll: {
            topLine: ev.line ?? 0,
            bottomLine: ev.bottomLine ?? ev.line ?? 0,
            total: ev.total ?? 0,
          },
        }
        break
      case "cursor": {
        const { selection: _, ...rest } = prev
        next = {
          ...rest,
          trigger: "cursor",
          cursor: { line: ev.line ?? 0 },
          ...scrollFromEvent,
        }
        break
      }
      case "selection":
        next = {
          ...prev,
          trigger: "selection",
          selection: {
            startLine: ev.startLine ?? 0,
            endLine: ev.endLine ?? 0,
          },
          ...scrollFromEvent,
        }
        break
      case "clear":
        next = {}
        break
      default:
        return
    }

    stateRef.current = next
    onUpdateRef.current(next)
  }, [])

  useWS(path, handler)
}
