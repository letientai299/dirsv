import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"
import { browse, type DirEntry } from "../lib/api"
import { FileIcon, ParentIcon } from "../lib/file-icon"
import { useSSE } from "../lib/use-sse"

interface Props {
  path: string
  entries: DirEntry[]
  onNavigate: (to: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [activeIndex, setActiveIndex] = useState(-1)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  const refresh = useCallback(() => {
    void browse(path).then((res) => {
      if (res.type === "dir") setEntries(res.entries)
    })
  }, [path])

  useSSE(path === "/" ? "" : path.replace(/^\//, ""), refresh)

  const parentPath =
    path === "/" ? null : path.replace(/\/[^/]+\/?$/, "") || "/"

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture when focus is in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, rows.length - 1))
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < rows.length) {
          e.preventDefault()
          onNavigate(rows[activeIndex].href)
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [rows, activeIndex, onNavigate])

  return (
    <div>
      <Toolbar path={path} />
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
  )
}
