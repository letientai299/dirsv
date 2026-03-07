import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { FocusOverlay } from "../components/focus-overlay"
import { useFocusOverlay } from "../lib/use-focus-overlay"

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
  const focus = useFocusOverlay()

  const openFocus = useCallback(() => {
    if (!svg) return
    focus.open([{ type: "diagram", svg }], 0)
  }, [svg, focus])

  useEffect(() => {
    // Keep old SVG visible while the new one renders — no flash to loading spinner.
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

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: diagram container acts as focus trigger */}
      <div
        class={className}
        ref={containerRef}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: needs focus for Enter key to open overlay
        tabIndex={0}
        onDblClick={openFocus}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Enter") openFocus()
        }}
      />
      {focus.overlayProps && <FocusOverlay {...focus.overlayProps} />}
    </>
  )
}
