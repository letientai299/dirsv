import { Fragment } from "preact"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { FolderIcon } from "../lib/file-icon"
import { navigate } from "../lib/navigate"
import { getEffectiveTheme, toggleTheme } from "../lib/theme"
import { useKeys } from "../lib/use-keys"

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

function Breadcrumbs({ path }: { path: string }) {
  if (path === "/") return <span>/</span>

  const segments = path.replace(/^\//, "").split("/")

  return (
    <>
      <a
        class="breadcrumb-link"
        href="/"
        onClick={(e) => {
          e.preventDefault()
          navigate("/")
        }}
      >
        <span class="entry-icon entry-icon--folder">
          <FolderIcon />
        </span>
        /
      </a>
      {segments.map((seg, i) => {
        const href = `/${segments.slice(0, i + 1).join("/")}`
        const isLast = i === segments.length - 1
        return (
          <Fragment key={seg}>
            {i > 0 && <span class="breadcrumb-sep">/</span>}
            {isLast ? (
              <span>{seg}</span>
            ) : (
              <a
                class="breadcrumb-link"
                href={href}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(href)
                }}
              >
                {seg}
              </a>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

function KeybindHelp() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useKeys((e) => {
    if (e.key === "?" && e.shiftKey) {
      e.preventDefault()
      setOpen((v) => !v)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div class="kb-help" ref={ref}>
      <button
        type="button"
        class="theme-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Keyboard shortcuts"
      >
        ?
      </button>
      {open && (
        <div class="kb-popover">
          <div class="kb-title">Keyboard shortcuts</div>
          <table class="kb-table">
            <tr>
              <td class="kb-keys">
                <kbd>j</kbd> <kbd>↓</kbd>
              </td>
              <td>Move down</td>
            </tr>
            <tr>
              <td class="kb-keys">
                <kbd>k</kbd> <kbd>↑</kbd>
              </td>
              <td>Move up</td>
            </tr>
            <tr>
              <td class="kb-keys">
                <kbd>l</kbd> <kbd>Enter</kbd>
              </td>
              <td>Open</td>
            </tr>
            <tr>
              <td class="kb-keys">
                <kbd>h</kbd> <kbd>Backspace</kbd> <kbd>Alt+↑</kbd>
              </td>
              <td>Go to parent</td>
            </tr>
            <tr>
              <td class="kb-keys">
                <kbd>gg</kbd> <kbd>Home</kbd>
              </td>
              <td>Jump to top</td>
            </tr>
            <tr>
              <td class="kb-keys">
                <kbd>G</kbd> <kbd>End</kbd>
              </td>
              <td>Jump to bottom</td>
            </tr>
          </table>
        </div>
      )}
    </div>
  )
}

export function Toolbar({ path }: Props) {
  const [isDark, setIsDark] = useState(() => getEffectiveTheme() === "dark")

  const toggle = useCallback(() => {
    const next = toggleTheme()
    setIsDark(next === "dark")
  }, [])

  return (
    <div class="toolbar">
      <div class="toolbar-path">
        <Breadcrumbs path={path} />
      </div>
      <div class="toolbar-actions">
        <KeybindHelp />
        <button
          type="button"
          class="theme-toggle"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </div>
  )
}
