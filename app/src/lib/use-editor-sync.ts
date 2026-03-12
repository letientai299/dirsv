import { useCallback, useEffect, useRef } from "preact/hooks"
import type { WsEvent } from "./use-ws"
import { useWS } from "./use-ws"

export interface EditorState {
  scroll?: { line: number; total: number }
  cursor?: { line: number }
  selection?: { startLine: number; endLine: number }
  /** Which event type triggered this update — drives scroll-into-view. */
  trigger?: "scroll" | "cursor" | "selection"
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

    switch (ev.type) {
      case "scroll":
        next = {
          ...prev,
          trigger: "scroll",
          scroll: { line: ev.line ?? 0, total: ev.total ?? 0 },
        }
        break
      case "cursor":
        next = { ...prev, trigger: "cursor", cursor: { line: ev.line ?? 0 } }
        break
      case "selection":
        next = {
          ...prev,
          trigger: "selection",
          selection: {
            startLine: ev.startLine ?? 0,
            endLine: ev.endLine ?? 0,
          },
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
