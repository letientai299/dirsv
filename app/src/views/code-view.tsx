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
        <div class="code-view">
          <pre>
            <code>
              {content.split("\n").map((line, i, arr) =>
                // Skip the trailing empty line from the final newline.
                i === arr.length - 1 && line === "" ? null : (
                  <>
                    <span class="line">{line}</span>
                    {"\n"}
                  </>
                ),
              )}
            </code>
          </pre>
        </div>
      )}
    </div>
  )
}
