import { useCallback, useState } from "preact/hooks"
import { cycleTheme, getEffectiveTheme } from "../lib/theme"

interface Props {
  path: string
}

// Octicon sun (16px)
function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061L12.36 4.7a.749.749 0 1 1-1.06-1.06l1.296-1.297a.75.75 0 0 1 1.06 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3.64 3.64a.749.749 0 1 1 1.06 1.06L3.404 5.997a.749.749 0 1 1-1.06-1.06L3.64 3.64ZM0 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8Zm3.404 2.003a.749.749 0 1 1 1.06 1.06L3.165 12.36a.749.749 0 1 1-1.06-1.06l1.3-1.297ZM8 16a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 1.5 0v1.5A.75.75 0 0 1 8 16Zm4.7-3.404a.749.749 0 1 1-1.06-1.06l1.297-1.296a.749.749 0 1 1 1.06 1.06l-1.298 1.296ZM16 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8Z" />
    </svg>
  )
}

// Octicon moon (16px)
function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z" />
    </svg>
  )
}

export function Toolbar({ path }: Props) {
  const [isDark, setIsDark] = useState(() => getEffectiveTheme() === "dark")

  const toggle = useCallback(() => {
    cycleTheme()
    setIsDark(getEffectiveTheme() === "dark")
  }, [])

  return (
    <div class="toolbar">
      <div class="toolbar-path">{path}</div>
      <button
        type="button"
        class="theme-toggle"
        onClick={toggle}
        aria-label="Toggle theme"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  )
}
