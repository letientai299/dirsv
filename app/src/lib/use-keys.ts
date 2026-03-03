import { useEffect } from "preact/hooks"

type KeyHandler = (e: KeyboardEvent) => void

/**
 * Register document-level keydown handlers.
 * Automatically skips events when focus is in INPUT/TEXTAREA/SELECT.
 */
export function useKeys(handler: KeyHandler, deps: unknown[]): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      handler(e)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps are caller-provided
  }, deps)
}
