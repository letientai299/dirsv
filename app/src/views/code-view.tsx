import { Toolbar } from "../components/toolbar"
import { langFromPath } from "../lib/lang"
import { useShiki } from "../lib/use-shiki"

interface Props {
  path: string
  content: string
}

export function CodeView({ path, content }: Props) {
  const lang = langFromPath(path) ?? "text"
  const html = useShiki(content, lang)

  return (
    <div>
      <Toolbar path={path} />
      {html ? (
        <div
          class="code-view"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe (no user HTML)
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre class="code-view-fallback">
          <code>{content}</code>
        </pre>
      )}
    </div>
  )
}
