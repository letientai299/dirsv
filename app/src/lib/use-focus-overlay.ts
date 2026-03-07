import { useCallback, useState } from "preact/hooks"

export type FocusItem =
  | { type: "image"; src: string; alt: string }
  | { type: "video"; src: string }
  | { type: "diagram"; svg: string }

interface FocusOverlayState {
  items: FocusItem[]
  startIndex: number
}

export function useFocusOverlay() {
  const [state, setState] = useState<FocusOverlayState | null>(null)

  const open = useCallback((items: FocusItem[], index: number) => {
    setState({ items, startIndex: index })
  }, [])

  const close = useCallback(() => {
    setState(null)
  }, [])

  // Update items without resetting the current index (e.g. after theme change).
  const updateItems = useCallback((items: FocusItem[]) => {
    setState((s) => (s ? { ...s, items } : null))
  }, [])

  return {
    isOpen: state !== null,
    open,
    close,
    updateItems,
    overlayProps: state
      ? { items: state.items, startIndex: state.startIndex, onClose: close }
      : null,
  }
}
