import { useEffect, useRef, useState } from "preact/hooks"
import { Toolbar } from "../components/toolbar"
import { renderDbml } from "../lib/dbml-render"

interface Props {
  path: string
  content: string
}

export function DbmlView({ path, content }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSvg(null)
    setError(null)
    let cancelled = false
    renderDbml(content)
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

  if (error) return <div class="error">DBML render error: {error}</div>
  if (svg === null) return <div class="loading">Rendering...</div>

  return (
    <div>
      <Toolbar path={path} />
      <div class="dbml-standalone" ref={containerRef} />
    </div>
  )
}
