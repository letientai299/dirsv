import DOMPurify from "dompurify"

/** Sanitize SVG output from diagram renderers, allowing only safe SVG elements. */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
  })
}
