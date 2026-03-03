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

    const elements = headings
      .map((h) => container.querySelector(`#${CSS.escape(h.id)}`))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    function update() {
      // Find the last heading that scrolled past the top (with a small offset)
      let current = elements[0]
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= 80) {
          current = el
        } else {
          break
        }
      }
      setActiveId(current.id)
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
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
