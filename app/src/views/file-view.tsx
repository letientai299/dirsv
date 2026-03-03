import { useCallback, useEffect, useState } from "preact/hooks"
import { parse as parseYaml } from "yaml"
import { Toolbar } from "../components/toolbar"
import { fetchRaw, type RawResult } from "../lib/api"
import { useSSE } from "../lib/use-sse"
import { CodeView } from "./code-view"
import { D2View } from "./d2-view"
import { GraphvizView } from "./graphviz-view"
import { HtmlView } from "./html-view"
import { MarkdownView } from "./markdown-view"
import { MediaView } from "./media-view"
import { StructuredView } from "./structured-view"

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

const imageRe = /\.(apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i
const videoRe = /\.(mp4|webm|ogg|mov)$/i

export function FileView({ path }: Props) {
  const isHtml = /\.html?$/i.test(path)
  const isImage = imageRe.test(path)
  const isVideo = videoRe.test(path)
  const [result, setResult] = useState<RawResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (isHtml || isImage || isVideo) return
      setError(null)
      fetchRaw(path, signal)
        .then(setResult)
        .catch((err: Error) => {
          if (err.name !== "AbortError") setError(err.message)
        })
    },
    [path, isHtml, isImage, isVideo],
  )

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Re-fetch on file changes (SSE-triggered, no abort needed).
  useSSE(path.replace(/^\//, ""), () => load())

  if (isHtml) return <HtmlView path={path} />
  if (isImage) return <MediaView path={path} kind="image" />
  if (isVideo) return <MediaView path={path} kind="video" />

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

  if (/\.(gv|dot)$/i.test(path)) {
    return <GraphvizView path={path} content={result.content} />
  }

  if (/\.d2$/i.test(path)) {
    return <D2View path={path} content={result.content} />
  }

  if (/\.json$/i.test(path)) {
    return (
      <StructuredView
        path={path}
        content={result.content}
        parse={JSON.parse}
        lang="json"
      />
    )
  }

  if (/\.ya?ml$/i.test(path)) {
    return (
      <StructuredView
        path={path}
        content={result.content}
        parse={parseYaml}
        lang="yaml"
      />
    )
  }

  return <CodeView path={path} content={result.content} />
}
