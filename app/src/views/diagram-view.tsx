import { useEffect, useRef, useState } from "preact/hooks"

interface Props {
  content: string
  render: (content: string) => Promise<string>
  label: string
  class: string
}

export function DiagramView({
  content,
  render,
  label,
  class: className,
}: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSvg(null)
    setError(null)
    let cancelled = false
    render(content)
      .then((result) => {
        if (!cancelled) setSvg(result)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [content, render])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !svg) return
    el.innerHTML = svg
  }, [svg])

  if (error)
    return (
      <div class="error">
        {label} render error: {error}
      </div>
    )
  if (svg === null) return <div class="loading">Rendering...</div>

  return <div class={className} ref={containerRef} />
}
