import type { JSX } from "preact"
import { Fragment } from "preact"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { browse } from "../lib/api"
import { FolderIcon } from "../lib/file-icon"
import { navigate, normalizePath } from "../lib/navigate"
import type { ShortcutDef } from "../lib/shortcuts"
import {
  focusPath,
  toggleHelp,
  toggleTheme as toggleThemeDef,
} from "../lib/shortcuts"
import {
  getEffectiveTheme,
  listenThemeChanges,
  toggleTheme,
} from "../lib/theme"
import { useKeys } from "../lib/use-keys"

interface Props {
  path: string
  shortcuts?: ShortcutDef[]
  actions?: JSX.Element
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

function Breadcrumbs({
  path,
  onEditLast,
}: {
  path: string
  onEditLast: () => void
}) {
  const editProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: onEditLast,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onEditLast()
    },
  }

  if (path === "/") return <span {...editProps}>/</span>

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
        /
      </a>
      {segments.map((seg, i) => {
        const href = `/${segments.slice(0, i + 1).join("/")}`
        const isLast = i === segments.length - 1
        return (
          <Fragment key={href}>
            {i > 0 && <span class="breadcrumb-sep">/</span>}
            {isLast ? (
              <span class="breadcrumb-last" {...editProps}>
                {seg}
              </span>
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

function PathBar({
  path,
  activateRef,
}: {
  path: string
  activateRef: { current: (() => void) | null }
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(path)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activate = useCallback(() => {
    setDraft(path)
    setEditing(true)
  }, [path])

  useEffect(() => {
    activateRef.current = activate
    return () => {
      activateRef.current = null
    }
  }, [activate, activateRef])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const cancel = useCallback(() => {
    setError(false)
    setEditing(false)
  }, [])

  const commit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return cancel()
      const normalized = normalizePath(trimmed, path)
      if (normalized === path) return cancel()
      try {
        await browse(normalized)
        setEditing(false)
        navigate(normalized)
      } catch {
        setError(false)
        requestAnimationFrame(() => {
          setError(true)
          inputRef.current?.select()
        })
      }
    },
    [path, cancel],
  )

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: Alt+L shortcut provides keyboard activation
    <div
      class={`toolbar-path${editing ? " toolbar-path--editing" : ""}${error ? " toolbar-path--error" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) activate()
      }}
    >
      <span class="entry-icon entry-icon--folder">
        <FolderIcon />
      </span>
      {editing ? (
        <input
          ref={inputRef}
          class="toolbar-path-input"
          type="text"
          value={draft}
          onInput={(e) => {
            setError(false)
            setDraft((e.target as HTMLInputElement).value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              void commit((e.target as HTMLInputElement).value)
            else if (e.key === "Escape") cancel()
            else if (focusPath.match(e)) {
              e.preventDefault()
              inputRef.current?.select()
            }
          }}
          onBlur={() => cancel()}
        />
      ) : (
        <Breadcrumbs path={path} onEditLast={activate} />
      )}
    </div>
  )
}

const globalShortcuts: ShortcutDef[] = [focusPath, toggleThemeDef, toggleHelp]

function renderKeys(keys: string) {
  return keys.split(" ").map((k, i) => (
    <Fragment key={k}>
      {i > 0 && " "}
      <kbd>{k}</kbd>
    </Fragment>
  ))
}

function KeybindHelp({ shortcuts }: { shortcuts: ShortcutDef[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useKeys((e) => {
    if (toggleHelp.match(e)) {
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

  const all = [...shortcuts, ...globalShortcuts]

  return (
    <div class="kb-help" ref={ref}>
      <button
        type="button"
        class="theme-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        ?
      </button>
      {open && (
        <div class="kb-popover">
          <div class="kb-title">Keyboard shortcuts</div>
          <table class="kb-table">
            <tbody>
              {all.map((s) => (
                <tr key={s.keys}>
                  <td>{s.description}</td>
                  <td class="kb-keys">{renderKeys(s.keys)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function Toolbar({ path, shortcuts, actions }: Props) {
  const [isDark, setIsDark] = useState(() => getEffectiveTheme() === "dark")
  const activateRef = useRef<(() => void) | null>(null)

  const toggle = useCallback(() => {
    const next = toggleTheme()
    setIsDark(next === "dark")
  }, [])

  useEffect(() => listenThemeChanges((t) => setIsDark(t === "dark")), [])

  useKeys(
    (e) => {
      if (toggleThemeDef.match(e)) {
        e.preventDefault()
        toggle()
      } else if (focusPath.match(e)) {
        e.preventDefault()
        activateRef.current?.()
      }
    },
    [toggle],
  )

  return (
    <div class="toolbar">
      <PathBar path={path} activateRef={activateRef} />
      <div class="toolbar-actions">
        {actions}
        <KeybindHelp shortcuts={shortcuts ?? []} />
        <button
          type="button"
          class="theme-toggle"
          onClick={toggle}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </div>
  )
}
