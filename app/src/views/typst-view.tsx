import { useEffect, useRef, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"
import { renderTypst } from "../lib/typst-render"

interface Props {
  path: string
  content: string
}

export function TypstView({ path, content }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSvg(null)
    setError(null)
    let cancelled = false
    renderTypst(content)
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

  if (error) return <div class="error">Typst render error: {error}</div>
  if (svg === null) return <div class="loading">Rendering...</div>

  return (
    <div>
      <Toolbar path={path} />
      <div class="typst-standalone" ref={containerRef} />
    </div>
  )
}
