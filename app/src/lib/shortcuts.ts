export interface ShortcutDef {
  keys: string
  description: string
  match: (e: KeyboardEvent) => boolean
}

export const moveDown: ShortcutDef = {
  keys: "j ↓",
  description: "Move down",
  match: (e) => e.key === "ArrowDown" || e.key === "j",
}

export const moveUp: ShortcutDef = {
  keys: "k ↑",
  description: "Move up",
  match: (e) => (e.key === "ArrowUp" && !e.altKey) || e.key === "k",
}

export const openEntry: ShortcutDef = {
  keys: "l Enter",
  description: "Open",
  match: (e) => e.key === "Enter" || (e.key === "l" && !e.altKey),
}

export const goToParent: ShortcutDef = {
  keys: "h Backspace Alt+↑",
  description: "Go to parent",
  match: (e) =>
    e.key === "h" || e.key === "Backspace" || (e.key === "ArrowUp" && e.altKey),
}

export const jumpToBottom: ShortcutDef = {
  keys: "G End",
  description: "Jump to bottom",
  match: (e) => e.key === "End" || e.key === "G",
}

export const toggleTheme: ShortcutDef = {
  keys: "Alt+D",
  description: "Toggle theme",
  match: (e) => e.code === "KeyD" && e.altKey,
}

export const toggleHelp: ShortcutDef = {
  keys: "Shift+/",
  description: "Toggle shortcuts help",
  match: (e) => e.key === "?" && e.shiftKey,
}

export const focusPath: ShortcutDef = {
  keys: "Alt+L",
  description: "Focus path bar",
  match: (e) => e.code === "KeyL" && e.altKey,
}

export const toggleSidebar: ShortcutDef = {
  keys: "Ctrl+B",
  description: "Toggle sidebar",
  match: (e) => e.key === "b" && (e.ctrlKey || e.metaKey),
}

/**
 * Factory for the `gg` double-tap shortcut. Returns a stateful matcher that
 * tracks the timer between g presses. Call once per component instance
 * (e.g., inside useMemo) to preserve timer across re-renders.
 *
 * The matcher must be called for every keydown (via useShortcuts) so it can
 * reset on non-g keys.
 */
export function createJumpToTop(): ShortcutDef {
  let lastG = 0
  return {
    keys: "gg Home",
    description: "Jump to top",
    match(e) {
      if (e.key === "Home") return true
      if (e.key !== "g") {
        lastG = 0
        return false
      }
      const now = Date.now()
      if (now - lastG < 500) {
        lastG = 0
        return true
      }
      lastG = now
      return false
    },
  }
}
