import { Toolbar } from "../components/toolbar"

interface Props {
  path: string
}

export function HtmlView({ path }: Props) {
  // Site root = directory containing the HTML file.
  // Encoded as a single path segment so the server can split root from
  // file path, keeping <base> stable across sub-page navigations.
  const dir = path.replace(/\/[^/]+$/, "").replace(/^\//, "")
  const fileName = path.split("/").pop() ?? ""
  const src = `/api/htmlpreview/${encodeURIComponent(dir)}/${encodeURIComponent(fileName)}`
  return (
    <div>
      <Toolbar path={path} />
      <iframe
        src={src}
        class="html-frame"
        title="HTML preview"
        sandbox="allow-scripts allow-forms allow-popups"
      />
    </div>
  )
}
