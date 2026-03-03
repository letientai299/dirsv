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
