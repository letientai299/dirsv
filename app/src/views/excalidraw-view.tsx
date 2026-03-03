import { useEffect, useRef, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"

interface Props {
  path: string
  content: string
}

export function ExcalidrawView({ path, content }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSvg(null)
    setError(null)
    let cancelled = false

    void (async () => {
      try {
        const data = JSON.parse(content)
        const { exportToSvg } = await import("@excalidraw/utils")
        const svgEl = await exportToSvg({
          elements: data.elements ?? [],
          appState: data.appState ?? {},
          files: data.files ?? {},
        })
        if (!cancelled) setSvg(svgEl.outerHTML)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [content])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !svg) return
    el.innerHTML = svg
  }, [svg])

  if (error) return <div class="error">Excalidraw render error: {error}</div>
  if (svg === null) return <div class="loading">Rendering...</div>

  return (
    <div>
      <Toolbar path={path} />
      <div class="excalidraw-standalone" ref={containerRef} />
    </div>
  )
}
