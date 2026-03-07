type Theme = "light" | "dark"

const STORAGE_KEY = "theme"

export function getEffectiveTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function toggleTheme(): Theme {
  const next = getEffectiveTheme() === "dark" ? "light" : "dark"
  document.documentElement.setAttribute("data-theme", next)
  localStorage.setItem(STORAGE_KEY, next)
  window.dispatchEvent(new CustomEvent("theme-change"))
  return next
}

/** Returns true when the active theme is dark (explicit override or OS preference). */
export function getIsDark(): boolean {
  const explicit = document.documentElement.dataset["theme"]
  if (explicit === "dark") return true
  if (explicit === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/** Listen for theme changes from other tabs via `storage` events. */
export function listenThemeChanges(cb: (theme: Theme) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    const theme =
      e.newValue === "light" || e.newValue === "dark"
        ? e.newValue
        : getEffectiveTheme()
    document.documentElement.setAttribute("data-theme", theme)
    cb(theme)
  }
  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}
