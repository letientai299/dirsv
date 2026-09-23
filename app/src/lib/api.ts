import { encodePath } from "./navigate"

export const MAX_TEXT_BYTES = 1_000_000
export const MAX_TEXT_LINES = 10_000

export function rawUrl(path: string): string {
  return `/api/raw${encodePath(path)}`
}

export interface DirEntry {
  name: string
  isDir: boolean
  isExec?: boolean
  size: number
  modTime: string
}

export type BrowseResponse =
  | { type: "dir"; entries: DirEntry[]; truncated?: boolean }
  | { type: "file"; path: string }
  | { type: "index"; path: string }

export async function browse(
  path: string,
  signal?: AbortSignal,
): Promise<BrowseResponse> {
  const apiPath = `/api/browse${encodePath(path)}`
  const res = await fetch(apiPath, signal ? { signal } : {})
  if (!res.ok) throw new Error(`browse ${path}: ${res.status}`)
  return res.json()
}

export type RawResult =
  | { kind: "text"; content: string }
  | { kind: "large"; url: string }
  | { kind: "binary"; url: string; contentType: string; size: number }

const textTypes =
  /^(text\/|application\/(json|xml|javascript|typescript|x-sh|x-httpd-php|toml|yaml|x-yaml))/

export interface VersionInfo {
  label: string
  url: string
}

export interface ServerInfo {
  pid?: number
  root: string
  version: VersionInfo
  highlightMs: number
}

let cachedInfo: ServerInfo | null = null

export async function fetchInfo(): Promise<ServerInfo> {
  if (cachedInfo) return cachedInfo
  const res = await fetch("/api/info")
  if (!res.ok) throw new Error(`info: ${res.status}`)
  const info: ServerInfo = await res.json()
  cachedInfo = info
  return info
}

export async function fetchRaw(
  path: string,
  signal?: AbortSignal,
): Promise<RawResult> {
  const apiPath = rawUrl(path)
  const res = await fetch(apiPath, signal ? { signal } : {})
  if (!res.ok) throw new Error(`raw ${path}: ${res.status}`)

  const ct = res.headers.get("Content-Type") ?? "application/octet-stream"
  const mime = ct.split(";")[0]?.trim() ?? ct
  if (textTypes.test(mime)) return readText(res, apiPath)
  // Binary — discard body and return metadata for download.
  res.body?.cancel()
  const size = Number(res.headers.get("Content-Length")) || 0
  return { kind: "binary", url: apiPath, contentType: mime, size }
}

async function readText(res: Response, apiPath: string): Promise<RawResult> {
  if (Number(res.headers.get("Content-Length")) > MAX_TEXT_BYTES) {
    await res.body?.cancel()
    return { kind: "large", url: apiPath }
  }
  const reader = res.body?.getReader()
  if (!reader) return { kind: "text", content: "" }
  const decoder = new TextDecoder()
  let bytes = 0
  let lines = 1
  let content = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      for (const byte of value) if (byte === 10) lines++
      if (bytes > MAX_TEXT_BYTES || lines > MAX_TEXT_LINES) {
        await reader.cancel()
        return { kind: "large", url: apiPath }
      }
      content += decoder.decode(value, { stream: true })
    }
    content += decoder.decode()
    return { kind: "text", content }
  } finally {
    reader.releaseLock()
  }
}
