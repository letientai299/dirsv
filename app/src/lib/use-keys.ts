import { useEffect, useRef } from "preact/hooks"

type KeyHandler = (e: KeyboardEvent) => void

interface HandlerSlot {
  current: KeyHandler
}

const handlers = new Set<HandlerSlot>()
const modalStack: HandlerSlot[] = []

function dispatch(e: KeyboardEvent) {
  const top = modalStack[modalStack.length - 1]
  if (top) {
    top.current(e)
    return
  }
  const tag = (e.target as HTMLElement).tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
  for (const h of handlers) h.current(e)
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", dispatch)
}

/**
 * Register document-level keydown handlers.
 * Automatically skips events when focus is in INPUT/TEXTAREA/SELECT
 * or when a modal layer is active.
 */
export function useKeys(handler: KeyHandler): void {
  const slot = useRef<HandlerSlot>({ current: handler })
  slot.current.current = handler

  useEffect(() => {
    const s = slot.current
    handlers.add(s)
    return () => {
      handlers.delete(s)
    }
  }, [])
}

/**
 * Register a modal keydown handler that takes exclusive control.
 * While active, all normal useKeys handlers are suppressed.
 * Supports nesting — the topmost modal receives events.
 */
export function useModalKeys(handler: KeyHandler): void {
  const slot = useRef<HandlerSlot>({ current: handler })
  slot.current.current = handler

  useEffect(() => {
    const s = slot.current
    modalStack.push(s)
    return () => {
      const idx = modalStack.indexOf(s)
      if (idx !== -1) modalStack.splice(idx, 1)
    }
  }, [])
}
