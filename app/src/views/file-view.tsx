import { useCallback, useEffect, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"
import { fetchRaw, type RawResult } from "../lib/api"
import { useSSE } from "../lib/use-sse"
import { CodeView } from "./code-view"
import { JsonView } from "./json-view"
import { MarkdownView } from "./markdown-view"

interface Props {
  path: string
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** i
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

export function FileView({ path }: Props) {
  const [result, setResult] = useState<RawResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    (signal?: AbortSignal) => {
      setError(null)
      fetchRaw(path, signal)
        .then(setResult)
        .catch((err: Error) => {
          if (err.name !== "AbortError") setError(err.message)
        })
    },
    [path],
  )

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Re-fetch on file changes (SSE-triggered, no abort needed).
  useSSE(path.replace(/^\//, ""), () => load())

  if (error) return <div class="error">Error: {error}</div>
  if (result === null) return <div class="loading">Loading...</div>

  if (result.kind === "binary") {
    const name = path.split("/").pop() ?? path
    return (
      <div>
        <Toolbar path={path} />
        <p>
          Binary file ({result.contentType}, {formatSize(result.size)})
        </p>
        <a href={result.url} download={name}>
          Download {name}
        </a>
      </div>
    )
  }

  if (/\.mdx?$/i.test(path)) {
    return <MarkdownView path={path} content={result.content} />
  }

  if (/\.json$/i.test(path)) {
    return <JsonView path={path} content={result.content} />
  }

  return <CodeView path={path} content={result.content} />
}
