import { useCallback } from "preact/hooks";
import type { DirEntry } from "../lib/api";
import { useSSE } from "../lib/use-sse";

interface Props {
  path: string;
  entries: DirEntry[];
  onNavigate: (to: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function DirView({ path, entries, onNavigate }: Props) {
  const refresh = useCallback(() => {
    // Force re-render by navigating to the same path.
    onNavigate(path);
  }, [path, onNavigate]);

  useSSE(path === "/" ? "" : path.replace(/^\//, ""), refresh);

  const parentPath = path === "/" ? null : path.replace(/\/[^/]+\/?$/, "") || "/";

  return (
    <div>
      <h1>{path}</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Modified</th>
          </tr>
        </thead>
        <tbody>
          {parentPath && (
            <tr>
              <td>
                <a
                  href={parentPath}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(parentPath);
                  }}
                >
                  ..
                </a>
              </td>
              <td />
              <td />
            </tr>
          )}
          {entries.map((entry) => {
            const href = (path === "/" ? "/" : path + "/") + entry.name;
            return (
              <tr key={entry.name}>
                <td>
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(href);
                    }}
                  >
                    {entry.name}
                    {entry.isDir ? "/" : ""}
                  </a>
                </td>
                <td>{entry.isDir ? "-" : formatSize(entry.size)}</td>
                <td>{formatDate(entry.modTime)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
