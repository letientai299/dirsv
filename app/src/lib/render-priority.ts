/**
 * Viewport-first rendering utilities.
 *
 * Partition diagram placeholders into [inViewport, offscreen] so renderers
 * can prioritise visible content. The viewport is defined by the nearest
 * `.file-content` scrollable ancestor.
 */

/**
 * Partition elements into [inViewport, offscreen] relative to the nearest
 * scrollable ancestor (.file-content).
 */
export function partitionByViewport(
  elements: Iterable<HTMLElement>,
): [HTMLElement[], HTMLElement[]] {
  const inViewport: HTMLElement[] = []
  const offscreen: HTMLElement[] = []

  const arr = Array.from(elements)
  if (arr.length === 0) return [inViewport, offscreen]

  const first = arr[0]
  if (!first) return [inViewport, offscreen]

  const scrollParent = first.closest(".file-content") as HTMLElement | null
  if (!scrollParent) {
    // No scrollable ancestor found — treat everything as in-viewport.
    return [arr, offscreen]
  }

  const parentRect = scrollParent.getBoundingClientRect()
  const viewTop = parentRect.top
  const viewBottom = viewTop + scrollParent.clientHeight

  for (const el of arr) {
    const rect = el.getBoundingClientRect()
    // Element overlaps the visible region of .file-content
    if (rect.bottom > viewTop && rect.top < viewBottom) {
      inViewport.push(el)
    } else {
      offscreen.push(el)
    }
  }

  return [inViewport, offscreen]
}

/** Yield to the main thread between offscreen renders. */
export function yieldToMain(): Promise<void> {
  const g = globalThis as { scheduler?: { yield?: () => Promise<void> } }
  if (typeof g.scheduler?.yield === "function") {
    return g.scheduler.yield()
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}
