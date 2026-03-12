import { getHighlightDuration } from "./highlight-config"

export const HIGHLIGHT_CLASS = "changed"

/** Add a brief background flash to an element, auto-removed after animation. */
export function markChanged(el: Element) {
  // Restart animation if already highlighted — remove class, force reflow,
  // then re-add so the browser treats it as a new animation.
  if (el.classList.contains(HIGHLIGHT_CLASS)) {
    el.classList.remove(HIGHLIGHT_CLASS)
    void (el as HTMLElement).offsetWidth
  }
  el.classList.add(HIGHLIGHT_CLASS)

  const onEnd = () => {
    el.classList.remove(HIGHLIGHT_CLASS)
    el.removeEventListener("animationend", onEnd)
  }
  el.addEventListener("animationend", onEnd, { once: true })

  // Fallback for reduced-motion (no animationend fires with the static style).
  setTimeout(
    () => el.classList.remove(HIGHLIGHT_CLASS),
    getHighlightDuration() + 50,
  )
}
