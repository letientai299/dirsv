import { useEffect, useRef, useState } from "preact/hooks"
import type { Heading } from "../lib/rehype-extract-headings"
import { useListKeys } from "../lib/use-list-keys"

interface Props {
  headings: Heading[]
  contentRef: { current: HTMLElement | null }
}

export function TableOfContents({ headings, contentRef }: Props) {
  const [activeId, setActiveId] = useState<string>("")
  const navRef = useRef<HTMLElement>(null)
  useListKeys(navRef, ".toc-link")

  useEffect(() => {
    const container = contentRef.current
    if (!container || headings.length === 0) return

    // The scroll container is .file-content, an ancestor of the markdown content.
    const scrollContainer = container.closest(".file-content") as
      | HTMLElement
      | undefined
    if (!scrollContainer) return

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
      if (current) setActiveId(current.id)
    }

    update()
    scrollContainer.addEventListener("scroll", update, { passive: true })
    return () => scrollContainer.removeEventListener("scroll", update)
  }, [headings, contentRef])

  if (headings.length === 0) return null

  const minDepth = Math.min(...headings.map((h) => h.depth))

  return (
    <nav class="toc" aria-label="Table of contents" ref={navRef}>
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
