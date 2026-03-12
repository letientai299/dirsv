import { lazy, Suspense } from "preact/compat"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { type BrowseResponse, browse, fetchInfo } from "./lib/api"
import { setHighlightDuration } from "./lib/highlight-config"
import { normalizePath, replaceLocation } from "./lib/navigate"
import { FileView } from "./views/file-view"

const DirView = lazy(() =>
  import("./views/dir-view").then((m) => ({ default: m.DirView })),
)

function cleanPathname(): string {
  const raw = decodeURIComponent(location.pathname)
  const clean = normalizePath(raw, "/")
  if (location.pathname !== clean) replaceLocation(clean)
  return clean
}

export function App() {
  const [path, setPath] = useState(cleanPathname)
  const [data, setData] = useState<BrowseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onPopState = () => setPath(cleanPathname())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const [rootName, setRootName] = useState("")
  useEffect(() => {
    void fetchInfo().then((info) => {
      setRootName(info.root)
      setHighlightDuration(info.highlightMs)
      document.documentElement.style.setProperty(
        "--highlight-duration",
        `${info.highlightMs}ms`,
      )
    })
  }, [])

  useEffect(() => {
    if (!rootName) return
    const display =
      path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path
    document.title = display === "/" ? rootName : `${display} — ${rootName}`
  }, [path, rootName])

  // Skip the next browse when we already resolved the response via redirect.
  const skipBrowse = useRef(false)

  useEffect(() => {
    if (skipBrowse.current) {
      skipBrowse.current = false
      return
    }
    const controller = new AbortController()
    // Don't setData(null) — keep the previous response so FileView stays
    // mounted (toolbar, sidebar, footer persist) while the next browse resolves.
    // FileView already manages its own loading state via the stale/fresh pattern.
    setError(null)
    browse(path, controller.signal)
      .then((res) => {
        // Dir with index.html → redirect to explicit index.html URL.
        if (res.type === "index") {
          const indexPath = `/${res.path}`
          skipBrowse.current = true
          replaceLocation(indexPath)
          setPath(indexPath)
          setData({ type: "file", path: res.path })
          return
        }
        // Dir listing without trailing slash → add it.
        if (res.type === "dir" && path !== "/" && !path.endsWith("/")) {
          const dirPath = `${path}/`
          skipBrowse.current = true
          replaceLocation(dirPath)
          setPath(dirPath)
        }
        setData(res)
      })
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

  return <FileView path={path} />
}
