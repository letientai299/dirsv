import { useMemo } from "preact/hooks"
import { langFromPath } from "../lib/lang"
import { useShiki } from "../lib/use-shiki"

interface Props {
  path: string
  content: string
}

export function CodeView({ path, content }: Props) {
  const lang = langFromPath(path) ?? "text"
  const html = useShiki(content, lang)

  const fallbackLines = useMemo(() => {
    const lines = content.split("\n")
    // Drop trailing empty element only if the file ends with a newline.
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    return lines
  }, [content])

  return html ? (
    <div
      class="code-view"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe (no user HTML)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <div class="code-view">
      <pre>
        <code>
          {fallbackLines.map((line) => (
            <>
              <span class="line">{line}</span>
              {"\n"}
            </>
          ))}
        </code>
      </pre>
    </div>
  )
}
