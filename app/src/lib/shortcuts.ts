export interface ShortcutDef {
  keys: string
  description: string
  match: (e: KeyboardEvent) => boolean
}

export const goToParent: ShortcutDef = {
  keys: "h Backspace Alt+↑",
  description: "Go to parent",
  match: (e) =>
    e.key === "h" || e.key === "Backspace" || (e.key === "ArrowUp" && e.altKey),
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

/** Display-only defs for the help dialog — handled by useListKeys. */
const noop = () => false
export const listNavShortcuts: ShortcutDef[] = [
  { keys: "j ↓", description: "Move down", match: noop },
  { keys: "k ↑", description: "Move up", match: noop },
  { keys: "l Enter", description: "Open", match: noop },
  { keys: "Home", description: "Jump to top", match: noop },
  { keys: "End", description: "Jump to bottom", match: noop },
]
