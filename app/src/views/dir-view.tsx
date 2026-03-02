import { useCallback, useState } from "preact/hooks"
import { browse, type DirEntry } from "../lib/api"
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
      <h1>{path}</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
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
                  ..
                </a>
              </td>
              <td />
              <td />
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
                    {entry.name}
                    {entry.isDir ? "/" : ""}
                  </a>
                </td>
                <td>{entry.isDir ? "-" : formatSize(entry.size)}</td>
                <td>{formatDate(entry.modTime)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
