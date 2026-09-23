import { fetchRaw, MAX_TEXT_BYTES, type RawResult } from "./api"

const MAX_ENTRIES = 20
const MAX_CACHE_BYTES = 8_000_000
const MAX_PREFETCHES = 4

interface CacheEntry {
  result: RawResult
  bytes: number
}

interface InflightEntry {
  promise: Promise<RawResult>
  controller: AbortController
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, InflightEntry>()
let cacheBytes = 0

export function getCached(path: string): RawResult | undefined {
  const entry = cache.get(path)
  if (!entry) return undefined
  cache.delete(path)
  cache.set(path, entry)
  return entry.result
}

function deleteCached(path: string) {
  cacheBytes -= cache.get(path)?.bytes ?? 0
  cache.delete(path)
}

function setCached(path: string, result: RawResult): void {
  const bytes = result.kind === "text" ? result.content.length * 2 : 0
  deleteCached(path)
  while (cache.size >= MAX_ENTRIES || cacheBytes + bytes > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) return
    deleteCached(oldest)
  }
  cache.set(path, { result, bytes })
  cacheBytes += bytes
}

function subscribe(
  promise: Promise<RawResult>,
  signal?: AbortSignal,
): Promise<RawResult> {
  if (!signal) return promise
  if (signal.aborted)
    return Promise.reject(new DOMException("Request aborted", "AbortError"))
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("Request aborted", "AbortError"))
    signal.addEventListener("abort", abort, { once: true })
    promise.then(
      (result) => {
        signal.removeEventListener("abort", abort)
        if (!signal.aborted) resolve(result)
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort)
        reject(error)
      },
    )
  })
}

export function prefetch(
  path: string,
  signal?: AbortSignal,
): Promise<RawResult> {
  if (signal?.aborted)
    return subscribe(Promise.resolve({ kind: "text", content: "" }), signal)
  const cached = getCached(path)
  if (cached) return Promise.resolve(cached)
  let entry = inflight.get(path)
  if (!entry) {
    const controller = new AbortController()
    const promise = fetchRaw(path, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCached(path, result)
        return result
      })
      .finally(() => {
        if (inflight.get(path)?.controller === controller) inflight.delete(path)
      })
    entry = { promise, controller }
    inflight.set(path, entry)
  }
  return subscribe(entry.promise, signal)
}

export function warmContent(
  path: string,
  size: number,
  signal?: AbortSignal,
): void {
  if (
    size > MAX_TEXT_BYTES ||
    inflight.size >= MAX_PREFETCHES ||
    signal?.aborted
  )
    return
  void prefetch(path, signal).catch(() => undefined)
}

export function invalidate(path: string): void {
  deleteCached(path)
  inflight.get(path)?.controller.abort()
  inflight.delete(path)
}

export function invalidateTree(path: string): void {
  const prefix = path.replace(/\/$/, "")
  for (const key of new Set([...cache.keys(), ...inflight.keys()])) {
    if (key === prefix || key.startsWith(`${prefix}/`)) invalidate(key)
  }
}

export function clearCache(): void {
  for (const { controller } of inflight.values()) controller.abort()
  cache.clear()
  cacheBytes = 0
  inflight.clear()
}
