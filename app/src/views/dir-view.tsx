import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { AppFooter } from "../components/app-footer"
import { Toolbar } from "../components/toolbar"
import { browse, type DirEntry } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { formatSize } from "../lib/format"
import { parentOf } from "../lib/path"
import {
  createJumpToTop,
  goToParent,
  jumpToBottom,
  moveDown,
  moveUp,
  openEntry,
} from "../lib/shortcuts"
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
  const [activeIndex, setActiveIndex] = useState(-1)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

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

  // Build flat list of navigable rows: parent (..) + entries
  const rows = useMemo(() => {
    const list: { href: string; key: string }[] = []
    if (parentPath) list.push({ href: parentPath, key: ".." })
    for (const entry of entries) {
      const href = (path === "/" ? "/" : `${path}/`) + entry.name
      list.push({ href, key: entry.name })
    }
    return list
  }, [parentPath, path, entries])

  // Reset active index on navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset intentionally triggers on path change
  useEffect(() => {
    setActiveIndex(-1)
  }, [path])

  // Scroll active row into view
  useEffect(() => {
    if (activeIndex < 0 || !tbodyRef.current) return
    const row = tbodyRef.current.children[activeIndex] as
      | HTMLElement
      | undefined
    row?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const jumpToTop = useMemo(() => createJumpToTop(), [])

  const shortcuts = useMemo<BoundShortcut[]>(
    () => [
      {
        def: goToParent,
        action(e) {
          const parent = rows[0]
          if (parent?.key !== "..") return
          e.preventDefault()
          onNavigate(parent.href)
        },
      },
      {
        def: jumpToTop,
        action(e) {
          e.preventDefault()
          setActiveIndex(() => 0)
        },
      },
      {
        def: moveDown,
        action(e) {
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, rows.length - 1))
        },
      },
      {
        def: moveUp,
        action(e) {
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
        },
      },
      {
        def: openEntry,
        action(e) {
          const row = rows[activeIndex]
          if (activeIndex >= 0 && row) {
            e.preventDefault()
            onNavigate(row.href)
          }
        },
      },
      {
        def: jumpToBottom,
        action(e) {
          e.preventDefault()
          setActiveIndex(() => rows.length - 1)
        },
      },
    ],
    [rows, activeIndex, onNavigate, jumpToTop],
  )

  const defs = useShortcuts(shortcuts, [shortcuts])

  return (
    <div class="dir-layout">
      <Toolbar path={path} shortcuts={defs} />
      <hr class="file-separator" />
      <div class="dir-scroll">
        <table class="dir-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="col-size">Size</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {parentPath && (
              <tr class={activeIndex === 0 ? "row-active" : ""}>
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
            {entries.map((entry, i) => {
              const href = (path === "/" ? "/" : `${path}/`) + entry.name
              const rowIndex = parentPath ? i + 1 : i
              return (
                <tr
                  key={entry.name}
                  class={activeIndex === rowIndex ? "row-active" : ""}
                >
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
