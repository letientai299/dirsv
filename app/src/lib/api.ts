export interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
  modTime: string;
}

export type BrowseResponse =
  | { type: "dir"; entries: DirEntry[] }
  | { type: "file"; path: string }
  | { type: "index"; path: string };

export async function browse(
  path: string,
  signal?: AbortSignal,
): Promise<BrowseResponse> {
  const apiPath = "/api/browse" + (path === "/" ? "/" : path);
  const res = await fetch(apiPath, { signal });
  if (!res.ok) throw new Error(`browse ${path}: ${res.status}`);
  return res.json();
}

export async function fetchRaw(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const apiPath = "/api/raw" + path;
  const res = await fetch(apiPath, { signal });
  if (!res.ok) throw new Error(`raw ${path}: ${res.status}`);
  return res.text();
}
