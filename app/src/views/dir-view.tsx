import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { AppFooter } from "../components/app-footer"
import { Toolbar } from "../components/toolbar"
import { browse, type DirEntry } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { formatSize } from "../lib/format"
import { parentOf } from "../lib/path"
import { goToParent, listNavShortcuts } from "../lib/shortcuts"
import { useListKeys } from "../lib/use-list-keys"
import type { BoundShortcut } from "../lib/use-shortcuts"
import { useShortcuts } from "../lib/use-shortcuts"
import { useWS } from "../lib/use-ws"

interface Props {
  path: string
  entries: DirEntry[]
  onNavigate: (to: string) => void
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
})

function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function DirView({ path, entries: initialEntries, onNavigate }: Props) {
  const [entries, setEntries] = useState(initialEntries)

  // Sync local entries when the parent provides a new listing (e.g. dir→dir navigation).
  useEffect(() => {
    setEntries(initialEntries)
  }, [initialEntries])

  const scrollRef = useRef<HTMLDivElement>(null)
  useListKeys(scrollRef, "a")

  // Auto-focus the first link on path change so j/k work immediately
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional focus on path change
  useEffect(() => {
    scrollRef.current?.querySelector<HTMLElement>("a")?.focus()
  }, [path])

  const refresh = useCallback(() => {
    browse(path)
      .then((res) => {
        if (res.type === "dir") setEntries(res.entries)
      })
      .catch(() => {
        // Silently ignore — directory may be inaccessible after rename/delete.
      })
  }, [path])

  useWS(path === "/" ? "" : path.replace(/^\//, ""), refresh)

  const parentPath = path === "/" ? null : parentOf(path)

  const shortcuts = useMemo<BoundShortcut[]>(
    () => [
      {
        def: goToParent,
        action(e) {
          if (!parentPath) return
          e.preventDefault()
          onNavigate(parentPath)
        },
      },
    ],
    [parentPath, onNavigate],
  )

  const defs = useShortcuts(shortcuts)

  return (
    <div class="dir-layout">
      <Toolbar path={path} shortcuts={[...defs, ...listNavShortcuts]} />
      <hr class="file-separator" />
      <div class="dir-scroll" ref={scrollRef}>
        <table class="dir-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="col-size">Size</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {parentPath && (
              <tr>
                <td>
                  <a
                    rel="up"
                    href={parentPath}
                    onClick={(e) => {
                      e.preventDefault()
                      onNavigate(parentPath)
                    }}
                  >
                    <span class="entry-icon">
                      <ParentIcon />
                    </span>
                    ..
                  </a>
                </td>
                <td class="col-size" />
                <td class="col-date" />
              </tr>
            )}
            {entries.map((entry) => {
              const href = (path === "/" ? "/" : `${path}/`) + entry.name
              return (
                <tr key={entry.name}>
                  <td>
                    <a
                      href={href}
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate(href)
                      }}
                    >
                      <span
                        class={`entry-icon${entry.isDir ? " entry-icon--folder" : ""}`}
                      >
                        <FileIcon
                          name={entry.name}
                          isDir={entry.isDir}
                          isExec={entry.isExec ?? false}
                        />
                      </span>
                      {entry.name}
                      {entry.isDir ? "/" : ""}
                    </a>
                  </td>
                  <td class="col-size">
                    {entry.isDir ? "\u2013" : formatSize(entry.size)}
                  </td>
                  <td class="col-date">{formatDate(entry.modTime)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AppFooter />
    </div>
  )
}
