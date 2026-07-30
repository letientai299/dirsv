export type LayoutMode = "constrained" | "full" | "smart"

const STORAGE_KEY = "dirsv-layout-mode"
const MODES: LayoutMode[] = ["constrained", "full", "smart"]
const DEFAULT_MODE: LayoutMode = "constrained"

function isLayoutMode(v: unknown): v is LayoutMode {
  return typeof v === "string" && (MODES as string[]).includes(v)
}

function readStored(): LayoutMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (isLayoutMode(v)) return v
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_MODE
}

export function getLayoutMode(): LayoutMode {
  const v = document.documentElement.dataset["layoutMode"]
  if (isLayoutMode(v)) return v
  return readStored()
}

export function applyLayoutMode(mode: LayoutMode): void {
  document.documentElement.dataset["layoutMode"] = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // localStorage may be unavailable
  }
}

export function cycleLayoutMode(): LayoutMode {
  const current = getLayoutMode()
  const next = MODES[(MODES.indexOf(current) + 1) % MODES.length] as LayoutMode
  applyLayoutMode(next)
  return next
}

/** Listen for layout mode changes from other tabs via storage events. */
export function listenLayoutModeChanges(
  cb: (mode: LayoutMode) => void,
): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !isLayoutMode(e.newValue)) return
    applyLayoutMode(e.newValue)
    cb(e.newValue)
  }
  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}

// Initialize from localStorage on module load.
applyLayoutMode(readStored())
