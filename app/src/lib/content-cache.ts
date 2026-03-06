import { fetchRaw, type RawResult } from "./api"

const MAX_ENTRIES = 20

interface CacheEntry {
  result: RawResult
}

interface InflightEntry {
  promise: Promise<RawResult>
  controller: AbortController
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, InflightEntry>()

/** Return cached result if available. */
export function getCached(path: string): RawResult | undefined {
  return cache.get(path)?.result
}

function setCached(path: string, result: RawResult): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(path, { result })
}

/**
 * Prefetch a path into the cache. Skips if already cached or in-flight.
 * Returns the promise so callers can optionally await, but fire-and-forget
 * is the intended use.
 */
export function prefetch(
  path: string,
  signal?: AbortSignal,
): Promise<RawResult> | undefined {
  if (cache.has(path)) return undefined
  if (inflight.has(path)) return inflight.get(path)?.promise

  const controller = new AbortController()
  // Propagate external abort into the internal controller
  signal?.addEventListener("abort", () => controller.abort(), { once: true })

  const p = fetchRaw(path, controller.signal)
    .then((result) => {
      inflight.delete(path)
      if (controller.signal.aborted) return result

      setCached(path, result)
      return result
    })
    .catch((err: Error) => {
      inflight.delete(path)
      throw err
    })

  inflight.set(path, { promise: p, controller })
  return p
}

/** Remove a single path from cache and abort any in-flight request. */
export function invalidate(path: string): void {
  cache.delete(path)
  inflight.get(path)?.controller.abort()
  inflight.delete(path)
}

/** Clear the entire cache and abort all in-flight requests. */
export function clearCache(): void {
  for (const { controller } of inflight.values()) controller.abort()
  cache.clear()
  inflight.clear()
}
