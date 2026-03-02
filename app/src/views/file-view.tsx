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

  const load = useCallback(() => {
    setError(null);
    fetchRaw(path)
      .then(setContent)
      .catch((err: Error) => setError(err.message));
  }, [path]);

  useEffect(() => {
    setContent(null);
    load();
  }, [load]);

  // Re-fetch on file changes.
  useSSE(path.replace(/^\//, ""), load);

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
