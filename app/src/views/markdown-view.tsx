import { useEffect, useState } from "preact/hooks";
import { renderMarkdown } from "../lib/markdown";

interface Props {
  path: string;
  content: string;
}

export function MarkdownView({ path, content }: Props) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    setHtml(null);
    renderMarkdown(content).then(setHtml);
  }, [content]);

  if (html === null) return <div class="loading">Rendering...</div>;

  return (
    <div>
      <h1>{path}</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
