import { useEffect, useRef, useState } from "preact/hooks"
import { renderGraphviz } from "../lib/graphviz-render"

interface Props {
  content: string
}

export function GraphvizView({ content }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSvg(null)
    setError(null)
    let cancelled = false
    renderGraphviz(content)
      .then((result) => {
        if (!cancelled) setSvg(result)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [content])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !svg) return
    el.innerHTML = svg
  }, [svg])

  if (error) return <div class="error">Graphviz render error: {error}</div>
  if (svg === null) return <div class="loading">Rendering...</div>

  return <div class="graphviz-standalone" ref={containerRef} />
}
