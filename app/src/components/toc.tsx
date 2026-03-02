import { useEffect, useState } from "preact/hooks"
import type { Heading } from "../lib/rehype-extract-headings"

interface Props {
  headings: Heading[]
  contentRef: { current: HTMLElement | null }
}

export function TableOfContents({ headings, contentRef }: Props) {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    const container = contentRef.current
    if (!container || headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0.1 },
    )

    const elements = headings
      .map((h) => container.querySelector(`#${CSS.escape(h.id)}`))
      .filter(Boolean) as Element[]

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [headings, contentRef])

  if (headings.length === 0) return null

  const minDepth = Math.min(...headings.map((h) => h.depth))

  return (
    <nav class="toc" aria-label="Table of contents">
      <ul class="toc-list">
        {headings.map((h) => (
          <li
            key={h.id}
            class={`toc-item${activeId === h.id ? " toc-item--active" : ""}`}
            style={{ paddingLeft: `${(h.depth - minDepth) * 12}px` }}
          >
            <a href={`#${h.id}`} class="toc-link">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
