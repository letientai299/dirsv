import { useEffect, useRef, useState } from "preact/hooks"
import { renderD2 } from "../lib/d2-render"

interface Props {
  content: string
}

export function D2View({ content }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSvg(null)
    setError(null)
    let cancelled = false
    renderD2(content)
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

  if (error) return <div class="error">D2 render error: {error}</div>
  if (svg === null) return <div class="loading">Rendering...</div>

  return <div class="d2-standalone" ref={containerRef} />
}
