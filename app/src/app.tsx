import { lazy, Suspense } from "preact/compat"
import { useCallback, useEffect, useState } from "preact/hooks"
import { type BrowseResponse, browse, fetchInfo } from "./lib/api"
import { FileView } from "./views/file-view"

const DirView = lazy(() =>
  import("./views/dir-view").then((m) => ({ default: m.DirView })),
)

export function App() {
  const [path, setPath] = useState(decodeURIComponent(location.pathname))
  const [data, setData] = useState<BrowseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onPopState = () => setPath(decodeURIComponent(location.pathname))
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const [rootName, setRootName] = useState("")
  useEffect(() => {
    void fetchInfo().then((info) => setRootName(info.root))
  }, [])

  useEffect(() => {
    if (!rootName) return
    document.title = path === "/" ? rootName : `${path} — ${rootName}`
  }, [path, rootName])

  useEffect(() => {
    const controller = new AbortController()
    // Don't setData(null) — keep the previous response so FileView stays
    // mounted (toolbar, sidebar, footer persist) while the next browse resolves.
    // FileView already manages its own loading state via the stale/fresh pattern.
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

  const fallback = <div class="loading">Loading...</div>

  if (data.type === "dir") {
    return (
      <Suspense fallback={fallback}>
        <DirView
          path={path}
          entries={data.entries ?? []}
          onNavigate={navigate}
        />
      </Suspense>
    )
  }

  // "index" response carries the resolved file path (e.g., "docs/index.html").
  const filePath = data.type === "index" ? `/${data.path}` : path
  return <FileView path={filePath} />
}
