import { useCallback, useState } from "preact/hooks"
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

  const refresh = useCallback(() => {
    void browse(path).then((res) => {
      if (res.type === "dir") setEntries(res.entries)
    })
  }, [path])

  useSSE(path === "/" ? "" : path.replace(/^\//, ""), refresh)

  const parentPath =
    path === "/" ? null : path.replace(/\/[^/]+\/?$/, "") || "/"

  return (
    <div>
      <div class="dir-path">{path}</div>
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
                      <FileIcon name={entry.name} isDir={entry.isDir} />
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
