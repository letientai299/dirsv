import { useCallback, useEffect, useState } from "preact/hooks";
import { fetchRaw } from "../lib/api";
import { useSSE } from "../lib/use-sse";
import { MarkdownView } from "./markdown-view";

interface Props {
  path: string;
}

export function FileView({ path }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setError(null);
      fetchRaw(path, signal)
        .then(setContent)
        .catch((err: Error) => {
          if (err.name !== "AbortError") setError(err.message);
        });
    },
    [path],
  );

  useEffect(() => {
    const controller = new AbortController();
    setContent(null);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Re-fetch on file changes (SSE-triggered, no abort needed).
  useSSE(path.replace(/^\//, ""), () => load());

  const isMarkdown = /\.md$/i.test(path);

  if (error) return <div class="error">Error: {error}</div>;
  if (content === null) return <div class="loading">Loading...</div>;

  if (isMarkdown) {
    return <MarkdownView path={path} content={content} />;
  }

  return (
    <div>
      <h1>{path}</h1>
      <pre>
        <code>{content}</code>
      </pre>
    </div>
  );
}
