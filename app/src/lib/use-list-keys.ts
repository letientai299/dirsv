import type { RefObject } from "preact"
import { useEffect } from "preact/hooks"

/**
 * Arrow-key navigation for a list of focusable elements within a container.
 * Supports arrows, j/k, Home/End, Enter/l to activate.
 */
export function useListKeys(
  containerRef: RefObject<HTMLElement>,
  itemSelector: string,
): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getItems = () =>
      Array.from(container.querySelectorAll<HTMLElement>(itemSelector))

    const focusItem = (el: HTMLElement | undefined) => {
      el?.focus()
      el?.scrollIntoView({ block: "nearest" })
    }

    const moveDown = (items: HTMLElement[], idx: number) =>
      focusItem(items[Math.min(idx + 1, items.length - 1)])
    const moveUp = (items: HTMLElement[], idx: number) =>
      focusItem(items[idx <= 0 ? 0 : idx - 1])
    const activate = (items: HTMLElement[], idx: number) => {
      if (idx >= 0) items[idx]?.click()
    }

    const handlers: Record<
      string,
      (items: HTMLElement[], idx: number) => void
    > = {
      ArrowDown: moveDown,
      j: moveDown,
      ArrowUp: moveUp,
      k: moveUp,
      Home: (items) => focusItem(items[0]),
      End: (items) => focusItem(items[items.length - 1]),
      Enter: activate,
      l: activate,
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      const handler = handlers[e.key]
      if (!handler) return
      const items = getItems()
      if (items.length === 0) return
      e.preventDefault()
      const active = document.activeElement as HTMLElement | null
      handler(items, active ? items.indexOf(active) : -1)
    }

    container.addEventListener("keydown", onKeyDown)
    return () => container.removeEventListener("keydown", onKeyDown)
  }, [containerRef, itemSelector])
}
