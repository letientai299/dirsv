export interface DirEntry {
  name: string
  isDir: boolean
  isExec?: boolean
  size: number
  modTime: string
}

export type BrowseResponse =
  | { type: "dir"; entries: DirEntry[] }
  | { type: "file"; path: string }
  | { type: "index"; path: string }

export async function browse(
  path: string,
  signal?: AbortSignal,
): Promise<BrowseResponse> {
  const apiPath = `/api/browse${path === "/" ? "/" : path}`
  const res = await fetch(apiPath, signal ? { signal } : {})
  if (!res.ok) throw new Error(`browse ${path}: ${res.status}`)
  return res.json()
}

export type RawResult =
  | { kind: "text"; content: string }
  | { kind: "binary"; url: string; contentType: string; size: number }

const textTypes =
  /^(text\/|application\/(json|xml|javascript|typescript|x-sh|x-httpd-php|toml|yaml|x-yaml))/

export interface ServerInfo {
  pid?: number
  root: string
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
  const apiPath = `/api/raw${path}`
  const res = await fetch(apiPath, signal ? { signal } : {})
  if (!res.ok) throw new Error(`raw ${path}: ${res.status}`)

  const ct = res.headers.get("Content-Type") ?? "application/octet-stream"
  const mime = ct.split(";")[0]?.trim() ?? ct
  if (textTypes.test(mime)) {
    return { kind: "text", content: await res.text() }
  }
  // Binary — discard body and return metadata for download.
  res.body?.cancel()
  const size = Number(res.headers.get("Content-Length")) || 0
  return { kind: "binary", url: apiPath, contentType: mime, size }
}
