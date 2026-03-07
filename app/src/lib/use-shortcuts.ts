import type { ShortcutDef } from "./shortcuts"
import { useKeys } from "./use-keys"

export interface BoundShortcut {
  def: ShortcutDef
  action: (e: KeyboardEvent) => void
}

/**
 * Registers a keydown handler that iterates ALL matchers on every keydown
 * (so stateful matchers like `gg` can track/reset), but fires only the first
 * matching action. Returns the ShortcutDef[] for display in the help popup.
 */
export function useShortcuts(shortcuts: BoundShortcut[]): ShortcutDef[] {
  useKeys((e) => {
    // Call ALL matchers so stateful ones (e.g., gg) can track/reset,
    // but only fire the first matching action.
    let matched: BoundShortcut["action"] | undefined
    for (const { def, action } of shortcuts) {
      if (def.match(e) && !matched) {
        matched = action
      }
    }
    matched?.(e)
  })

  return shortcuts.map((s) => s.def)
}
