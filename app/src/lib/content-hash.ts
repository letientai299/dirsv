/** Fast string hash for content-change detection. Not cryptographic. */
export function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h.toString(36)
}

/**
 * Returns true if the element's rendered content is still valid (source
 * unchanged). Uses a `data-${prefix}Hash` attribute to track the hash.
 */
export function isRenderedAndUnchanged(
  el: HTMLElement,
  source: string,
  prefix: string,
): boolean {
  const hash = simpleHash(source)
  const key = `${prefix}Hash`
  if (el.classList.contains(`${prefix}-rendered`) && el.dataset[key] === hash)
    return true
  el.dataset[key] = hash
  return false
}

/**
 * Strip rendered markers so the next render pass re-processes these elements.
 * Inverse of the marking done by renderers after `isRenderedAndUnchanged`.
 */
export function resetRendered(container: HTMLElement, prefix: string): void {
  for (const el of container.querySelectorAll<HTMLElement>(
    `.${prefix}-rendered`,
  )) {
    el.classList.remove(`${prefix}-rendered`, "diagram-rendered")
    delete el.dataset[`${prefix}Hash`]
  }
}
