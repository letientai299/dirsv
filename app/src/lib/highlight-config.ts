let durationMs = 500

export function setHighlightDuration(ms: number) {
  durationMs = ms
}

export function getHighlightDuration(): number {
  return durationMs
}
