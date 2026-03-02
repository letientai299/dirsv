type Theme = "light" | "dark" | "system"
type Resolved = "light" | "dark"

const STORAGE_KEY = "theme"

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark") return stored
  return "system"
}

export function getEffectiveTheme(): Resolved {
  const theme = getTheme()
  if (theme !== "system") return theme
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function applyTheme(theme: Theme): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme")
    localStorage.removeItem(STORAGE_KEY)
  } else {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }
}

/** Cycle: system → light → dark → system */
export function cycleTheme(): Theme {
  const current = getTheme()
  const next: Theme =
    current === "system" ? "light" : current === "light" ? "dark" : "system"
  applyTheme(next)
  return next
}
