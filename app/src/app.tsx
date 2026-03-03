import { useCallback, useEffect, useState } from "preact/hooks"
import { type BrowseResponse, browse } from "./lib/api"
import { DirView } from "./views/dir-view"
import { FileView } from "./views/file-view"

export function App() {
  const [path, setPath] = useState(decodeURIComponent(location.pathname))
  const [data, setData] = useState<BrowseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onPopState = () => setPath(decodeURIComponent(location.pathname))
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)
    browse(path, controller.signal)
      .then(setData)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message)
      })
    return () => controller.abort()
  }, [path])

  const navigate = useCallback((to: string) => {
    history.pushState(null, "", to)
    setPath(to)
  }, [])

  if (error) return <div class="error">Error: {error}</div>
  if (!data) return <div class="loading">Loading...</div>

  if (data.type === "dir") {
    return (
      <DirView path={path} entries={data.entries ?? []} onNavigate={navigate} />
    )
  }

  // "index" response carries the resolved file path (e.g., "docs/index.html").
  const filePath = data.type === "index" ? `/${data.path}` : path
  return <FileView path={filePath} />
}
